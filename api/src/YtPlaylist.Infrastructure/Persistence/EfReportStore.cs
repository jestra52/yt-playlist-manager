using Microsoft.EntityFrameworkCore;
using YtPlaylist.Application.Reports;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Reports;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Stores playlist backups with Entity Framework Core.</summary>
public sealed class EfReportStore(AppDbContext db) : IReportStore
{
    public async Task<bool> SaveAsync(Report report, long deletedBefore, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(report);
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var exists = await db.Reports.AnyAsync(r => r.ChainId == report.ChainId && r.Id == report.Id, cancellationToken);
            if (!exists)
            {
                db.Reports.Add(report);
                await db.SaveChangesAsync(cancellationToken);
                await this.TrimPlaylistAsync(report.ChainId, report.PlaylistId, cancellationToken);
                await this.RemoveOfDeletedPlaylistsAsync(report.ChainId, deletedBefore, cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
            db.ChangeTracker.Clear();
            return !exists;
        });
    }

    /// <summary>Keeps the first backup and the newest ones.</summary>
    private async Task TrimPlaylistAsync(string chainId, string playlistId, CancellationToken cancellationToken)
    {
        var ids = await db.Reports
            .Where(r => r.ChainId == chainId && r.PlaylistId == playlistId)
            .OrderBy(r => r.CreatedAt)
            .ThenBy(r => r.Id)
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);
        var extra = ids.Skip(1).SkipLast(SyncLimits.KeptReportsPerPlaylist).ToList();
        if (extra.Count > 0)
        {
            await db.Reports
                .Where(r => r.ChainId == chainId && extra.Contains(r.Id))
                .ExecuteDeleteAsync(cancellationToken);
        }
    }

    private async Task RemoveOfDeletedPlaylistsAsync(string chainId, long deletedBefore, CancellationToken cancellationToken)
    {
        var gone = db.Playlists
            .Where(p => p.ChainId == chainId && p.Deleted && p.UpdatedAt < deletedBefore)
            .Select(p => p.Id);
        await db.Reports
            .Where(r => r.ChainId == chainId && gone.Contains(r.PlaylistId))
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ReportInfo>> ListAsync(
        string chainId, string? playlistId, CancellationToken cancellationToken) =>
        await db.Reports
            .AsNoTracking()
            .Where(r => r.ChainId == chainId && (playlistId == null || r.PlaylistId == playlistId))
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .Select(r => new ReportInfo(r.Id, r.PlaylistId, r.PlaylistName, r.Reason, r.VideoCount, r.CreatedAt))
            .ToListAsync(cancellationToken);

    public Task<Report?> FindAsync(string chainId, string id, CancellationToken cancellationToken) =>
        db.Reports.AsNoTracking().FirstOrDefaultAsync(r => r.ChainId == chainId && r.Id == id, cancellationToken);
}
