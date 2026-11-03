using YtPlaylist.Models.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// Adding a device with a short-lived pairing code instead of the chain code: a device in the
/// chain creates the code, the new device enters it, the first device approves, and only then
/// does the new device get its credential (created when it collects it, so never stored).
/// </summary>
public sealed partial class ChainService
{
    /// <summary>
    /// A new pairing code for the caller's chain, replacing the caller's previous one. Shown
    /// once. Null when pairing is paused for the chain after repeated refused attempts.
    /// </summary>
    public async Task<PairingCodeInfo?> StartPairingAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var chainStore = this.RequireStore();
        var now = this.Now();
        var chain = await chainStore.FindChainAsync(caller.ChainId, cancellationToken).ConfigureAwait(false);
        if (chain?.PairingLockedUntil > now)
        {
            return null;
        }
        var code = hasher.NewPairingCode();
        var pairing = new SyncPairing
        {
            Id = NewId(),
            ChainId = caller.ChainId,
            CreatedByDeviceId = caller.DeviceId,
            CodeHash = hasher.Hash(code),
            Status = PairingStatus.Waiting,
            CreatedAt = now,
            ExpiresAt = now + (long)PairingCode.Lifetime.TotalMilliseconds,
        };
        await chainStore
            .CreatePairingAsync(pairing, this.Event(caller.ChainId, ChainEventKind.PairingStarted, caller.DeviceName), cancellationToken)
            .ConfigureAwait(false);
        return new PairingCodeInfo(PairingCode.Format(code), pairing.ExpiresAt);
    }

    /// <summary>Where the caller's pairing code stands; null when it has none.</summary>
    public async Task<PairingInfo?> DescribePairingAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var pairing = await this.RequireStore().FindPairingByCreatorAsync(caller.DeviceId, cancellationToken).ConfigureAwait(false);
        return pairing is null ? null : new PairingInfo(this.StatusOf(pairing), pairing.RequesterName, pairing.ExpiresAt);
    }

    /// <summary>Lets the device that entered the caller's code join; false when no request is waiting.</summary>
    public async Task<bool> ApprovePairingAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var chainStore = this.RequireStore();
        var pairing = await this.FindRequestAsync(caller, cancellationToken).ConfigureAwait(false);
        if (pairing is null)
        {
            return false;
        }
        var auditEvent = this.Event(caller.ChainId, ChainEventKind.PairingApproved, caller.DeviceName, pairing.RequesterName);
        return await chainStore
            .ApprovePairingAsync(pairing.Id, caller.DeviceId, this.Now(), auditEvent, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Refuses the device that entered the caller's code. It counts as a strike: after a few,
    /// pairing is paused for the chain. False when no request is waiting.
    /// </summary>
    public async Task<bool> DenyPairingAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var chainStore = this.RequireStore();
        var pairing = await this.FindRequestAsync(caller, cancellationToken).ConfigureAwait(false);
        if (pairing is null)
        {
            return false;
        }
        var strike = await this.StrikeAsync(caller.ChainId, ChainEventKind.PairingDenied, caller.DeviceName, pairing.RequesterName, cancellationToken)
            .ConfigureAwait(false);
        return await chainStore.DenyPairingAsync(pairing.Id, caller.DeviceId, this.Now(), strike, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>Cancels the caller's pairing code, if it has one.</summary>
    public Task CancelPairingAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        return this.RequireStore().CancelPairingAsync(caller.DeviceId, cancellationToken);
    }

    /// <summary>
    /// A new device entered a pairing code: it waits for the device that created the code to
    /// approve it. Null when the code doesn't match an open pairing; entering a code that another
    /// device already entered is also refused, and counts as a strike against its chain.
    /// </summary>
    /// <exception cref="Domain.Common.DomainValidationException">When the device name is too long.</exception>
    public async Task<PairingTicket?> RequestPairingAsync(string code, string deviceName, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        var name = CleanDeviceName(deviceName);
        var canonical = PairingCode.Normalize(code);
        if (canonical is null)
        {
            return null;
        }
        var pairing = await chainStore.FindPairingByCodeHashAsync(hasher.Hash(canonical), cancellationToken).ConfigureAwait(false);
        var now = this.Now();
        if (pairing is null || pairing.ExpiresAt <= now)
        {
            return null;
        }
        var token = hasher.NewSecret();
        var expiresAt = now + (long)PairingCode.ApprovalWindow.TotalMilliseconds;
        var requested = pairing.Status == PairingStatus.Waiting
            && await chainStore.RequestPairingAsync(pairing.Id, name, hasher.Hash(token), now, expiresAt, cancellationToken)
                .ConfigureAwait(false);
        if (!requested)
        {
            var strike = await this.StrikeAsync(pairing.ChainId, ChainEventKind.PairingBlocked, name, "", cancellationToken)
                .ConfigureAwait(false);
            await chainStore.AddPairingStrikeAsync(strike, cancellationToken).ConfigureAwait(false);
            return null;
        }
        return new PairingTicket(token, expiresAt);
    }

    /// <summary>
    /// What the new device's request came to. When it was approved, the first call adds the
    /// device to the chain and returns its new credential; later calls say it expired. Null
    /// when the token is unknown.
    /// </summary>
    public async Task<PairingResult?> CollectPairingAsync(string requestToken, CancellationToken cancellationToken)
    {
        var chainStore = this.RequireStore();
        if (!IsSecret(requestToken))
        {
            return null;
        }
        var pairing = await chainStore.FindPairingByRequestTokenHashAsync(hasher.Hash(requestToken), cancellationToken)
            .ConfigureAwait(false);
        if (pairing is null)
        {
            return null;
        }
        var status = this.StatusOf(pairing);
        if (status != PairingStatus.Approved)
        {
            return new PairingResult(status == PairingStatus.Joined ? PairingStatus.Expired : status);
        }
        var (device, credential) = this.NewDevice(pairing.ChainId, pairing.RequesterName);
        var joined = await chainStore
            .CompletePairingAsync(
                pairing.Id, this.Now(), device, this.Event(pairing.ChainId, ChainEventKind.DeviceJoined, device.Name), cancellationToken)
            .ConfigureAwait(false);
        return joined
            ? new PairingResult(PairingStatus.Approved, pairing.ChainId, device.Id, credential)
            : new PairingResult(PairingStatus.Expired);
    }

    /// <summary>The caller's pairing, when a device entered its code and is waiting for a decision.</summary>
    private async Task<SyncPairing?> FindRequestAsync(DeviceContext caller, CancellationToken cancellationToken)
    {
        var pairing = await this.RequireStore().FindPairingByCreatorAsync(caller.DeviceId, cancellationToken).ConfigureAwait(false);
        return pairing is not null && this.StatusOf(pairing) == PairingStatus.Requested ? pairing : null;
    }

    /// <summary>A pairing's status, with the time it expired at taken into account.</summary>
    private string StatusOf(SyncPairing pairing) =>
        pairing.Status is PairingStatus.Joined or PairingStatus.Denied || pairing.ExpiresAt > this.Now()
            ? pairing.Status
            : PairingStatus.Expired;

    private async Task<PairingStrike> StrikeAsync(
        string chainId, string kind, string deviceName, string detail, CancellationToken cancellationToken)
    {
        var now = this.Now();
        var chain = await this.RequireStore().FindChainAsync(chainId, cancellationToken).ConfigureAwait(false);
        var since = Math.Max(now - (long)PairingCode.StrikeWindow.TotalMilliseconds, chain?.PairingLockedUntil ?? 0);
        return new PairingStrike(
            chainId,
            this.Event(chainId, kind, deviceName, detail),
            since,
            PairingCode.StrikeLimit,
            now + (long)PairingCode.LockDuration.TotalMilliseconds,
            this.Event(chainId, ChainEventKind.PairingLocked, ""));
    }
}
