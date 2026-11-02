using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>Storage for sync chains and their devices (implemented with Entity Framework Core).</summary>
public interface IChainStore
{
    public Task<SyncChain?> FindChainBySecretHashAsync(string secretHash, CancellationToken cancellationToken);

    public Task<SyncDevice?> FindDeviceByCredentialHashAsync(string credentialHash, CancellationToken cancellationToken);

    /// <summary>Creates a chain together with its first device.</summary>
    public Task CreateChainAsync(SyncChain chain, SyncDevice device, CancellationToken cancellationToken);

    public Task AddDeviceAsync(SyncDevice device, CancellationToken cancellationToken);

    /// <summary>The chain's devices, oldest first.</summary>
    public Task<IReadOnlyList<SyncDevice>> ListDevicesAsync(string chainId, CancellationToken cancellationToken);

    /// <summary>Removes a device of the chain; false when the chain has no such device.</summary>
    public Task<bool> RemoveDeviceAsync(string chainId, string deviceId, CancellationToken cancellationToken);

    /// <summary>
    /// Gives the chain a new secret and removes every device but <paramref name="keepDeviceId"/>,
    /// in one transaction, so the old code and the other devices stop working together.
    /// </summary>
    public Task ReplaceSecretAsync(string chainId, string secretHash, string keepDeviceId, CancellationToken cancellationToken);

    /// <summary>Deletes the chain, its devices and all its playlists and videos.</summary>
    public Task DeleteChainAsync(string chainId, CancellationToken cancellationToken);

    /// <summary>
    /// Gives the unclaimed legacy chain a secret and its first device. False when it was
    /// already claimed (only one device can ever claim it).
    /// </summary>
    public Task<bool> ClaimLegacyChainAsync(string secretHash, SyncDevice device, CancellationToken cancellationToken);

    /// <summary>Records that the device used the API at <paramref name="now"/>.</summary>
    public Task TouchDeviceAsync(string deviceId, long now, CancellationToken cancellationToken);
}
