using System.Text.RegularExpressions;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// Sync chain use cases: create, join and claim a chain, authenticate devices, and
/// manage a chain's devices and code. Secrets are generated here and only their
/// peppered hashes are stored; the secrets are returned once and never logged.
/// </summary>
/// <param name="hasher">Creates secrets and the hashes stored instead of them.</param>
/// <param name="time">The clock, for creation and "last seen" times.</param>
/// <param name="store">Null when no database is configured; chains are unavailable then.</param>
public sealed partial class ChainService(ISecretHasher hasher, TimeProvider time, IChainStore? store = null)
{
    /// <summary>Devices update their "last seen" time at most this often.</summary>
    private static readonly TimeSpan TouchInterval = TimeSpan.FromMinutes(5);

    public bool IsAvailable => store is not null && hasher.IsConfigured;

    /// <summary>Creates a new chain with this device in it.</summary>
    public async Task<ChainAccess> CreateAsync(string deviceName, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        var secret = hasher.NewSecret();
        var chain = new SyncChain { Id = NewId(), SecretHash = hasher.Hash(secret), CreatedAt = this.Now() };
        var (device, credential) = this.NewDevice(chain.Id, deviceName);
        await chainStore.CreateChainAsync(chain, device, cancellationToken).ConfigureAwait(false);
        return new ChainAccess(chain.Id, device.Id, credential, secret);
    }

    /// <summary>Joins the chain whose code has <paramref name="secret"/>; null when no chain has it.</summary>
    public async Task<ChainAccess?> JoinAsync(string secret, string deviceName, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        if (!IsSecret(secret))
        {
            return null;
        }
        var chain = await chainStore.FindChainBySecretHashAsync(hasher.Hash(secret), cancellationToken).ConfigureAwait(false);
        if (chain is null)
        {
            return null;
        }
        var (device, credential) = this.NewDevice(chain.Id, deviceName);
        await chainStore.AddDeviceAsync(device, cancellationToken).ConfigureAwait(false);
        return new ChainAccess(chain.Id, device.Id, credential, Secret: null);
    }

    /// <summary>
    /// Turns the library synced with the old shared SYNC_TOKEN into a real chain with a
    /// code, with this device in it. Null when it was already claimed. The caller checks the token.
    /// </summary>
    public async Task<ChainAccess?> ClaimLegacyAsync(string deviceName, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        var secret = hasher.NewSecret();
        var (device, credential) = this.NewDevice(SyncChain.LegacyId, deviceName);
        var claimed = await chainStore.ClaimLegacyChainAsync(hasher.Hash(secret), device, cancellationToken).ConfigureAwait(false);
        return claimed ? new ChainAccess(SyncChain.LegacyId, device.Id, credential, secret) : null;
    }

    /// <summary>The device a credential belongs to, or null when it's unknown or was removed.</summary>
    public async Task<DeviceContext?> AuthenticateAsync(string credential, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        if (!IsSecret(credential))
        {
            return null;
        }
        var device = await chainStore.FindDeviceByCredentialHashAsync(hasher.Hash(credential), cancellationToken)
            .ConfigureAwait(false);
        if (device is null)
        {
            return null;
        }
        var now = this.Now();
        if (now - device.LastSeenAt >= (long)TouchInterval.TotalMilliseconds)
        {
            await chainStore.TouchDeviceAsync(device.Id, now, cancellationToken).ConfigureAwait(false);
        }
        return new DeviceContext(device.ChainId, device.Id);
    }

    public async Task<ChainInfo> DescribeAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var devices = await this.RequireStore().ListDevicesAsync(caller.ChainId, cancellationToken).ConfigureAwait(false);
        return new ChainInfo(
            caller.ChainId,
            caller.DeviceId,
            [.. devices.Select(d => new DeviceInfo(d.Id, d.Name, d.CreatedAt, d.LastSeenAt))]);
    }

    /// <summary>Removes a device of the caller's chain (the caller itself to leave); false when there's no such device.</summary>
    public Task<bool> RemoveDeviceAsync(DeviceContext caller, string deviceId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        return this.RequireStore().RemoveDeviceAsync(caller.ChainId, deviceId, cancellationToken);
    }

    /// <summary>
    /// Gives the caller's chain a new code and removes every other device, so a leaked code
    /// or a lost device stops working. Returns the new secret, shown once.
    /// </summary>
    public async Task<ChainSecret> ReplaceSecretAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var secret = hasher.NewSecret();
        await this.RequireStore()
            .ReplaceSecretAsync(caller.ChainId, hasher.Hash(secret), caller.DeviceId, cancellationToken)
            .ConfigureAwait(false);
        return new ChainSecret(secret);
    }

    /// <summary>Deletes the caller's chain with all its devices and data.</summary>
    public Task DeleteAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        return this.RequireStore().DeleteChainAsync(caller.ChainId, cancellationToken);
    }

    /// <exception cref="DomainValidationException">When the device name is too long.</exception>
    private (SyncDevice Device, string Credential) NewDevice(string chainId, string deviceName)
    {
        var name = (deviceName ?? "").Trim();
        if (name.EnumerateRunes().Count() > SyncLimits.MaxDeviceNameLength)
        {
            throw new DomainValidationException($"device name is longer than {SyncLimits.MaxDeviceNameLength} characters");
        }
        var credential = hasher.NewSecret();
        var now = this.Now();
        var device = new SyncDevice
        {
            Id = NewId(),
            ChainId = chainId,
            CredentialHash = hasher.Hash(credential),
            Name = name.Length > 0 ? name : "Unnamed device",
            CreatedAt = now,
            LastSeenAt = now,
        };
        return (device, credential);
    }

    private IChainStore RequireStore() =>
        this.IsAvailable ? store! : throw new InvalidOperationException("Sync chains need a database and SYNC_PEPPER.");

    private long Now() => time.GetUtcNow().ToUnixTimeMilliseconds();

    private static string NewId() => Guid.NewGuid().ToString("N");

    /// <summary>A secret is 32 bytes as unpadded base64url: exactly 43 characters.</summary>
    private static bool IsSecret(string? value) => value is not null && SecretFormat().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9_-]{43}$")]
    private static partial Regex SecretFormat();
}
