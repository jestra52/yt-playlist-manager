using Microsoft.EntityFrameworkCore;
using YtPlaylist.Application.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Stores sync chains, their devices, recovery codes and audit log with Entity Framework Core.</summary>
public sealed class EfChainStore(AppDbContext db) : IChainStore
{
    public Task<SyncChain?> FindChainBySecretHashAsync(string secretHash, CancellationToken cancellationToken) =>
        db.SyncChains.AsNoTracking().FirstOrDefaultAsync(c => c.SecretHash == secretHash, cancellationToken);

    public Task<SyncDevice?> FindDeviceByCredentialHashAsync(string credentialHash, CancellationToken cancellationToken) =>
        db.SyncDevices.AsNoTracking().FirstOrDefaultAsync(d => d.CredentialHash == credentialHash, cancellationToken);

    public Task<string?> FindChainIdByRecoveryCodeHashAsync(string codeHash, CancellationToken cancellationToken) =>
        db.SyncRecoveryCodes
            .AsNoTracking()
            .Where(r => r.CodeHash == codeHash)
            .Select(r => r.ChainId)
            .FirstOrDefaultAsync(cancellationToken);

    public Task CreateChainAsync(
        SyncChain chain,
        SyncDevice device,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                db.SyncChains.Add(chain);
                await db.SaveChangesAsync(cancellationToken);
                db.SyncDevices.Add(device);
                db.SyncRecoveryCodes.AddRange(recoveryCodes);
                db.SyncChainEvents.Add(auditEvent);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task AddDeviceAsync(SyncDevice device, SyncChainEvent auditEvent, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                db.SyncDevices.Add(device);
                db.SyncChainEvents.Add(auditEvent);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public async Task<IReadOnlyList<SyncDevice>> ListDevicesAsync(string chainId, CancellationToken cancellationToken) =>
        await db.SyncDevices
            .AsNoTracking()
            .Where(d => d.ChainId == chainId)
            .OrderBy(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<bool> RemoveDeviceAsync(
        string chainId, string deviceId, SyncChainEvent auditEvent, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                var removed = await db.SyncDevices
                    .Where(d => d.ChainId == chainId && d.Id == deviceId)
                    .ExecuteDeleteAsync(cancellationToken);
                if (removed == 0)
                {
                    return false;
                }
                db.SyncChainEvents.Add(auditEvent);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task<bool> ResetAccessAsync(ChainReset reset, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(reset);
        return this.InTransactionAsync(
            async () =>
            {
                // Waits for a sync in progress, and makes the next one see the removed devices.
                await SyncCounterLock.LockAsync(db, cancellationToken);

                // Using the code is the first write, so of two recoveries with the same code
                // only one finds it; the other changes nothing.
                if (reset.UsedRecoveryCodeHash is { } usedHash)
                {
                    var used = await db.SyncRecoveryCodes
                        .Where(r => r.ChainId == reset.ChainId && r.CodeHash == usedHash)
                        .ExecuteDeleteAsync(cancellationToken);
                    if (used == 0)
                    {
                        return false;
                    }
                }

                await db.SyncChains
                    .Where(c => c.Id == reset.ChainId)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.SecretHash, reset.SecretHash), cancellationToken);

                var removed = db.SyncDevices.Where(d => d.ChainId == reset.ChainId && d.Id != reset.KeepDeviceId);
                var removedNames = await removed.OrderBy(d => d.CreatedAt).Select(d => d.Name).ToListAsync(cancellationToken);
                await removed.ExecuteDeleteAsync(cancellationToken);

                await db.SyncRecoveryCodes.Where(r => r.ChainId == reset.ChainId).ExecuteDeleteAsync(cancellationToken);
                db.SyncRecoveryCodes.AddRange(reset.RecoveryCodes);
                if (reset.NewDevice is not null)
                {
                    db.SyncDevices.Add(reset.NewDevice);
                }
                reset.Event.Detail = ChainReset.RemovedDevicesDetail(removedNames);
                db.SyncChainEvents.Add(reset.Event);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);
    }

    public Task ReplaceRecoveryCodesAsync(
        string chainId,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                await db.SyncRecoveryCodes.Where(r => r.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                db.SyncRecoveryCodes.AddRange(recoveryCodes);
                db.SyncChainEvents.Add(auditEvent);
                await db.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task<int> CountRecoveryCodesAsync(string chainId, CancellationToken cancellationToken) =>
        db.SyncRecoveryCodes.CountAsync(r => r.ChainId == chainId, cancellationToken);

    public async Task<IReadOnlyList<SyncChainEvent>> ListEventsAsync(
        string chainId, int limit, CancellationToken cancellationToken) =>
        await db.SyncChainEvents
            .AsNoTracking()
            .Where(e => e.ChainId == chainId)
            .OrderByDescending(e => e.At)
            .ThenByDescending(e => e.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);

    public Task DeleteChainAsync(string chainId, CancellationToken cancellationToken) =>
        this.InTransactionAsync(
            async () =>
            {
                // Children first, so it doesn't depend on the database enforcing cascades.
                await db.Videos.Where(v => v.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.Playlists.Where(p => p.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.SyncDevices.Where(d => d.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.SyncRecoveryCodes.Where(r => r.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.SyncChainEvents.Where(e => e.ChainId == chainId).ExecuteDeleteAsync(cancellationToken);
                await db.SyncChains.Where(c => c.Id == chainId).ExecuteDeleteAsync(cancellationToken);
                return true;
            },
            cancellationToken);

    public Task<bool> ClaimLegacyChainAsync(
        string secretHash,
        SyncDevice device,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken) =>
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
                db.SyncRecoveryCodes.AddRange(recoveryCodes);
                db.SyncChainEvents.Add(auditEvent);
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
