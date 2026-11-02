using Microsoft.EntityFrameworkCore;
using YtPlaylist.Application.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Stores sync chains and their devices with Entity Framework Core.</summary>
public sealed class EfChainStore(AppDbContext db) : IChainStore
{
    public Task<SyncChain?> FindChainBySecretHashAsync(string secretHash, CancellationToken cancellationToken) =>
        db.SyncChains.AsNoTracking().FirstOrDefaultAsync(c => c.SecretHash == secretHash, cancellationToken);

    public Task<SyncDevice?> FindDeviceByCredentialHashAsync(string credentialHash, CancellationToken cancellationToken) =>
        db.SyncDevices.AsNoTracking().FirstOrDefaultAsync(d => d.CredentialHash == credentialHash, cancellationToken);

    public Task CreateChainAsync(SyncChain chain, SyncDevice device, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                db.SyncChains.Add(chain);
                await db.SaveChangesAsync(cancellationToken);
                db.SyncDevices.Add(device);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public async Task AddDeviceAsync(SyncDevice device, CancellationToken cancellationToken)
    {
        db.SyncDevices.Add(device);
        await db.SaveChangesAsync(cancellationToken);
        db.ChangeTracker.Clear();
    }

    public async Task<IReadOnlyList<SyncDevice>> ListDevicesAsync(string chainId, CancellationToken cancellationToken) =>
        await db.SyncDevices
            .AsNoTracking()
            .Where(d => d.ChainId == chainId)
            .OrderBy(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<bool> RemoveDeviceAsync(string chainId, string deviceId, CancellationToken cancellationToken) =>
        await db.SyncDevices
            .Where(d => d.ChainId == chainId && d.Id == deviceId)
            .ExecuteDeleteAsync(cancellationToken) > 0;

    public Task ReplaceSecretAsync(string chainId, string secretHash, string keepDeviceId, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                await db.SyncChains
                    .Where(c => c.Id == chainId)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.SecretHash, secretHash), cancellationToken);
                await db.SyncDevices
                    .Where(d => d.ChainId == chainId && d.Id != keepDeviceId)
                    .ExecuteDeleteAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task DeleteChainAsync(string chainId, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                // Children first, so it doesn't depend on the database enforcing cascades.
                await db.Videos.Where(v => v.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.Playlists.Where(p => p.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.SyncDevices.Where(d => d.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.SyncChains.Where(c => c.Id == chainId).ExecuteDeleteAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task<bool> ClaimLegacyChainAsync(string secretHash, SyncDevice device, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                // Only the first claim finds the secret still empty; any later one changes nothing.
                var claimed = await db.SyncChains
                    .Where(c => c.Id == SyncChain.LegacyId && c.SecretHash == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.SecretHash, secretHash), cancellationToken);
                if (claimed == 0)
                {
                    return false;
                }
                db.SyncDevices.Add(device);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task TouchDeviceAsync(string deviceId, long now, CancellationToken cancellationToken) =>
        db.SyncDevices
            .Where(d => d.Id == deviceId)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.LastSeenAt, now), cancellationToken);

    /// <summary>
    /// Runs <paramref name="work"/> in a transaction through the execution strategy, so a dropped
    /// connection replays the whole unit (see DependencyInjection) instead of leaving half of it.
    /// </summary>
    private async Task<bool> InTransactionAsync(Func<Task<bool>> work, CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var result = await work();
            await transaction.CommitAsync(cancellationToken);
            db.ChangeTracker.Clear();
            return result;
        });
    }
}
