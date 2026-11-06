using System.Text.RegularExpressions;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// Sync chain use cases: create, join, claim and recover a chain, authenticate devices, and
/// manage a chain's devices, code, recovery codes and audit log; adding a device with a
/// pairing code is in ChainService.Pairing.cs. Secrets are generated here
/// and only their peppered hashes are stored; the secrets are returned once and never logged.
/// </summary>
/// <param name="hasher">Creates secrets and the hashes stored instead of them.</param>
/// <param name="time">The clock, for creation and "last seen" times.</param>
/// <param name="store">Null when no database is configured; chains are unavailable then.</param>
public sealed partial class ChainService(ISecretHasher hasher, TimeProvider time, IChainStore? store = null)
{
    /// <summary>The most audit log entries one request returns.</summary>
    public const int MaxEvents = 200;

    /// <summary>Devices update their "last seen" time at most this often.</summary>
    private static readonly TimeSpan TouchInterval = TimeSpan.FromMinutes(5);

    public bool IsAvailable => store is not null && hasher.IsConfigured;

    /// <summary>Creates a new chain with this device in it, and its recovery codes.</summary>
    public async Task<ChainAccess> CreateAsync(string deviceName, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        var secret = hasher.NewSecret();
        var chain = new SyncChain { Id = NewId(), SecretHash = hasher.Hash(secret), CreatedAt = this.Now() };
        var (device, credential) = this.NewDevice(chain.Id, deviceName);
        var (codes, codeRows) = this.NewRecoveryCodes(chain.Id);
        await chainStore
            .CreateChainAsync(chain, device, codeRows, this.Event(chain.Id, ChainEventKind.Created, device.Name), cancellationToken)
            .ConfigureAwait(false);
        return new ChainAccess(chain.Id, device.Id, credential, secret, codes);
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
        await chainStore
            .AddDeviceAsync(device, this.Event(chain.Id, ChainEventKind.DeviceJoined, device.Name), cancellationToken)
            .ConfigureAwait(false);
        return new ChainAccess(chain.Id, device.Id, credential, Secret: null, RecoveryCodes: null);
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
        var (codes, codeRows) = this.NewRecoveryCodes(SyncChain.LegacyId);
        var auditEvent = this.Event(SyncChain.LegacyId, ChainEventKind.Claimed, device.Name);
        var claimed = await chainStore
            .ClaimLegacyChainAsync(hasher.Hash(secret), device, codeRows, auditEvent, cancellationToken)
            .ConfigureAwait(false);
        return claimed ? new ChainAccess(SyncChain.LegacyId, device.Id, credential, secret, codes) : null;
    }

    /// <summary>
    /// Recovers the chain that has this unused recovery code, from any device: the chain gets
    /// a new code and new recovery codes, every old device is removed and this device joins.
    /// The data stays. Null when no chain has the code (or it was just used).
    /// </summary>
    public async Task<ChainAccess?> RecoverAsync(string recoveryCode, string deviceName, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        var canonical = RecoveryCode.Normalize(recoveryCode);
        if (canonical is null)
        {
            return null;
        }
        var codeHash = hasher.Hash(canonical);
        var chainId = await chainStore.FindChainIdByRecoveryCodeHashAsync(codeHash, cancellationToken).ConfigureAwait(false);
        if (chainId is null)
        {
            return null;
        }
        var (device, credential) = this.NewDevice(chainId, deviceName);
        var renewed = await this.RunRecoveryHookAsync(
                chainId,
                ChainEventKind.Recovered,
                device.Name,
                reset => reset with { NewDevice = device, UsedRecoveryCodeHash = codeHash },
                cancellationToken)
            .ConfigureAwait(false);
        return renewed is null
            ? null
            : new ChainAccess(chainId, device.Id, credential, renewed.Secret, renewed.RecoveryCodes);
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
        return new DeviceContext(device.ChainId, device.Id, device.Name);
    }

    public async Task<ChainInfo> DescribeAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var chainStore = this.RequireStore();
        var devices = await chainStore.ListDevicesAsync(caller.ChainId, cancellationToken).ConfigureAwait(false);
        var codesLeft = await chainStore.CountRecoveryCodesAsync(caller.ChainId, cancellationToken).ConfigureAwait(false);
        var chain = await chainStore.FindChainAsync(caller.ChainId, cancellationToken).ConfigureAwait(false);
        return new ChainInfo(
            caller.ChainId,
            caller.DeviceId,
            [.. devices.Select(d => new DeviceInfo(d.Id, d.Name, d.CreatedAt, d.LastSeenAt))],
            codesLeft,
            chain?.PairingLockedUntil > this.Now() ? chain.PairingLockedUntil : null);
    }

    /// <summary>Removes a device of the caller's chain (the caller itself to leave); false when there's no such device.</summary>
    public async Task<bool> RemoveDeviceAsync(DeviceContext caller, string deviceId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var chainStore = this.RequireStore();
        var devices = await chainStore.ListDevicesAsync(caller.ChainId, cancellationToken).ConfigureAwait(false);
        var removed = devices.FirstOrDefault(d => d.Id == deviceId);
        if (removed is null)
        {
            return false;
        }
        var auditEvent = removed.Id == caller.DeviceId
            ? this.Event(caller.ChainId, ChainEventKind.DeviceLeft, caller.DeviceName)
            : this.Event(caller.ChainId, ChainEventKind.DeviceRemoved, caller.DeviceName, removed.Name);
        return await chainStore.RemoveDeviceAsync(caller.ChainId, deviceId, auditEvent, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Gives the caller's chain a new code and new recovery codes and removes every other
    /// device, so a leaked code or a lost device stops working. Returns them, shown once.
    /// </summary>
    public async Task<ChainSecret> ReplaceSecretAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var renewed = await this.RunRecoveryHookAsync(
                caller.ChainId,
                ChainEventKind.CodeReplaced,
                caller.DeviceName,
                reset => reset with { KeepDeviceId = caller.DeviceId },
                cancellationToken)
            .ConfigureAwait(false);
        return renewed!;
    }

    /// <summary>New recovery codes for the caller's chain; the old ones stop working. Shown once.</summary>
    public async Task<RecoveryCodes> RenewRecoveryCodesAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var (codes, codeRows) = this.NewRecoveryCodes(caller.ChainId);
        await this.RequireStore()
            .ReplaceRecoveryCodesAsync(
                caller.ChainId,
                codeRows,
                this.Event(caller.ChainId, ChainEventKind.RecoveryCodesRenewed, caller.DeviceName),
                cancellationToken)
            .ConfigureAwait(false);
        return new RecoveryCodes(codes);
    }

    /// <summary>The caller's chain's audit log, newest first.</summary>
    public async Task<IReadOnlyList<ChainEventInfo>> ListEventsAsync(
        DeviceContext caller, int? limit, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var count = limit is > 0 and <= MaxEvents ? limit.Value : MaxEvents;
        var events = await this.RequireStore().ListEventsAsync(caller.ChainId, count, cancellationToken).ConfigureAwait(false);
        return [.. events.Select(e => new ChainEventInfo(e.At, e.Kind, e.DeviceName, e.Detail))];
    }

    /// <summary>Deletes the caller's chain with all its devices and data.</summary>
    public Task DeleteAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        return this.RequireStore().DeleteChainAsync(caller.ChainId, cancellationToken);
    }

    /// <summary>
    /// The recovery hook: the one step every way of replacing a chain's code runs (recovering,
    /// "Generate a new code", and later the cleanup of abandoned chains). In one transaction it
    /// gives the chain a new secret and new recovery codes, removes the old devices and logs it,
    /// so requests with an old credential are refused from then on. Null when
    /// <paramref name="configure"/> names a recovery code that was used in the meantime.
    /// </summary>
    /// <remarks>
    /// #53 extends this: the connected accounts' tokens are deleted in the same transaction,
    /// and their grants are revoked at Google once it's committed.
    /// </remarks>
    private async Task<ChainSecret?> RunRecoveryHookAsync(
        string chainId,
        string kind,
        string deviceName,
        Func<ChainReset, ChainReset> configure,
        CancellationToken cancellationToken)
    {
        var secret = hasher.NewSecret();
        var (codes, codeRows) = this.NewRecoveryCodes(chainId);
        var reset = configure(new ChainReset(chainId, hasher.Hash(secret), codeRows, this.Event(chainId, kind, deviceName)));
        var done = await this.RequireStore().ResetAccessAsync(reset, cancellationToken).ConfigureAwait(false);
        return done ? new ChainSecret(secret, codes) : null;
    }

    /// <summary>The device name as stored: trimmed, or "Unnamed device" when empty.</summary>
    /// <exception cref="DomainValidationException">When the device name is too long.</exception>
    private static string CleanDeviceName(string? deviceName)
    {
        var name = (deviceName ?? "").Trim();
        if (name.EnumerateRunes().Count() > SyncLimits.MaxDeviceNameLength)
        {
            throw new DomainValidationException($"device name is longer than {SyncLimits.MaxDeviceNameLength} characters");
        }
        return name.Length > 0 ? name : "Unnamed device";
    }

    /// <exception cref="DomainValidationException">When the device name is too long.</exception>
    private (SyncDevice Device, string Credential) NewDevice(string chainId, string deviceName)
    {
        var name = CleanDeviceName(deviceName);
        var credential = hasher.NewSecret();
        var now = this.Now();
        var device = new SyncDevice
        {
            Id = NewId(),
            ChainId = chainId,
            CredentialHash = hasher.Hash(credential),
            Name = name,
            CreatedAt = now,
            LastSeenAt = now,
        };
        return (device, credential);
    }

    /// <summary>A new set of recovery codes: as shown to the person, and the rows that store their hashes.</summary>
    private (IReadOnlyList<string> Codes, IReadOnlyList<SyncRecoveryCode> Rows) NewRecoveryCodes(string chainId)
    {
        var now = this.Now();
        var canonical = Enumerable.Range(0, RecoveryCode.SetSize).Select(_ => hasher.NewRecoveryCode()).ToList();
        var rows = canonical
            .Select(c => new SyncRecoveryCode { Id = NewId(), ChainId = chainId, CodeHash = hasher.Hash(c), CreatedAt = now })
            .ToList();
        return ([.. canonical.Select(RecoveryCode.Format)], rows);
    }

    private SyncChainEvent Event(string chainId, string kind, string deviceName, string detail = "") =>
        new() { ChainId = chainId, At = this.Now(), Kind = kind, DeviceName = deviceName, Detail = detail };

    private IChainStore RequireStore() =>
        this.IsAvailable ? store! : throw new InvalidOperationException("Sync chains need a database and SYNC_PEPPER.");

    private long Now() => time.GetUtcNow().ToUnixTimeMilliseconds();

    private static string NewId() => Guid.NewGuid().ToString("N");

    /// <summary>A secret is 32 bytes as unpadded base64url: exactly 43 characters.</summary>
    private static bool IsSecret(string? value) => value is not null && SecretFormat().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9_-]{43}$")]
    private static partial Regex SecretFormat();
}
