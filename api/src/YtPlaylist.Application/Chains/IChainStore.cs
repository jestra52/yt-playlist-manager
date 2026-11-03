using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// Storage for sync chains, their devices, recovery codes and audit log (implemented with
/// Entity Framework Core). Every write that takes an audit entry stores it in the same transaction.
/// </summary>
public interface IChainStore
{
    public Task<SyncChain?> FindChainBySecretHashAsync(string secretHash, CancellationToken cancellationToken);

    public Task<SyncDevice?> FindDeviceByCredentialHashAsync(string credentialHash, CancellationToken cancellationToken);

    /// <summary>The ID of the chain with this unused recovery code, or null.</summary>
    public Task<string?> FindChainIdByRecoveryCodeHashAsync(string codeHash, CancellationToken cancellationToken);

    /// <summary>Creates a chain together with its first device and its recovery codes.</summary>
    public Task CreateChainAsync(
        SyncChain chain,
        SyncDevice device,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken);

    public Task AddDeviceAsync(SyncDevice device, SyncChainEvent auditEvent, CancellationToken cancellationToken);

    /// <summary>The chain's devices, oldest first.</summary>
    public Task<IReadOnlyList<SyncDevice>> ListDevicesAsync(string chainId, CancellationToken cancellationToken);

    /// <summary>Removes a device of the chain; false when the chain has no such device (nothing is logged then).</summary>
    public Task<bool> RemoveDeviceAsync(
        string chainId, string deviceId, SyncChainEvent auditEvent, CancellationToken cancellationToken);

    /// <summary>
    /// The recovery hook's writes, in one transaction that waits for any sync in progress:
    /// the new secret, every old device removed but the kept one (or the new one added), the
    /// recovery codes replaced and the audit entry. False, with nothing changed, when
    /// <see cref="ChainReset.UsedRecoveryCodeHash"/> is no longer an unused code of the chain.
    /// </summary>
    public Task<bool> ResetAccessAsync(ChainReset reset, CancellationToken cancellationToken);

    /// <summary>Replaces every recovery code of the chain, in one transaction with the audit entry.</summary>
    public Task ReplaceRecoveryCodesAsync(
        string chainId,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken);

    public Task<int> CountRecoveryCodesAsync(string chainId, CancellationToken cancellationToken);

    /// <summary>The chain's audit log, newest first, at most <paramref name="limit"/> entries.</summary>
    public Task<IReadOnlyList<SyncChainEvent>> ListEventsAsync(string chainId, int limit, CancellationToken cancellationToken);

    /// <summary>Deletes the chain, its devices, recovery codes, audit log and all its playlists and videos.</summary>
    public Task DeleteChainAsync(string chainId, CancellationToken cancellationToken);

    /// <summary>
    /// Gives the unclaimed legacy chain a secret, its first device and its recovery codes.
    /// False when it was already claimed (only one device can ever claim it).
    /// </summary>
    public Task<bool> ClaimLegacyChainAsync(
        string secretHash,
        SyncDevice device,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken);

    /// <summary>Records that the device used the API at <paramref name="now"/>.</summary>
    public Task TouchDeviceAsync(string deviceId, long now, CancellationToken cancellationToken);

    public Task<SyncChain?> FindChainAsync(string chainId, CancellationToken cancellationToken);

    /// <summary>
    /// Stores a new pairing code with its audit entry, replacing any other pairing of the
    /// device that created it, and deletes every pairing (of any chain) that has expired.
    /// </summary>
    public Task CreatePairingAsync(SyncPairing pairing, SyncChainEvent auditEvent, CancellationToken cancellationToken);

    /// <summary>The pairing the device created (a device has at most one), or null.</summary>
    public Task<SyncPairing?> FindPairingByCreatorAsync(string deviceId, CancellationToken cancellationToken);

    public Task<SyncPairing?> FindPairingByCodeHashAsync(string codeHash, CancellationToken cancellationToken);

    public Task<SyncPairing?> FindPairingByRequestTokenHashAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>
    /// Records that a device entered the code, if the pairing is still waiting and hasn't expired
    /// at <paramref name="now"/>: of two devices entering the same code, only one gets it.
    /// </summary>
    public Task<bool> RequestPairingAsync(
        string pairingId,
        string requesterName,
        string requestTokenHash,
        long now,
        long expiresAt,
        CancellationToken cancellationToken);

    /// <summary>Approves the request, if it's the creating device's and still unexpired; logs it in the same transaction.</summary>
    public Task<bool> ApprovePairingAsync(
        string pairingId, string creatorDeviceId, long now, SyncChainEvent auditEvent, CancellationToken cancellationToken);

    /// <summary>Denies the request, if it's the creating device's and still unexpired, and records the strike with it.</summary>
    public Task<bool> DenyPairingAsync(
        string pairingId, string creatorDeviceId, long now, PairingStrike strike, CancellationToken cancellationToken);

    /// <summary>Records a strike against the chain; true when it paused pairing.</summary>
    public Task<bool> AddPairingStrikeAsync(PairingStrike strike, CancellationToken cancellationToken);

    /// <summary>
    /// Adds the approved device and marks the pairing joined, in one transaction with the audit
    /// entry. False, with nothing changed, when it isn't approved or has expired at <paramref name="now"/>.
    /// </summary>
    public Task<bool> CompletePairingAsync(
        string pairingId, long now, SyncDevice device, SyncChainEvent auditEvent, CancellationToken cancellationToken);

    /// <summary>Deletes the pairing the device created, if any.</summary>
    public Task CancelPairingAsync(string creatorDeviceId, CancellationToken cancellationToken);
}
