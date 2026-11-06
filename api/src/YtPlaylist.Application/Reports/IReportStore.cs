using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Reports;

namespace YtPlaylist.Application.Reports;

/// <summary>Cloud storage for playlist backups, one sync chain at a time.</summary>
public interface IReportStore
{
    /// <summary>
    /// Saves a backup unless its ID is already in the chain, then removes what's no longer kept:
    /// a playlist's backups beyond its first and last ones, and those of playlists deleted before
    /// <paramref name="deletedBefore"/>. Returns false when the ID was already there.
    /// </summary>
    public Task<bool> SaveAsync(Report report, long deletedBefore, CancellationToken cancellationToken);

    /// <summary>The chain's backups, newest first, only of one playlist when <paramref name="playlistId"/> is set.</summary>
    public Task<IReadOnlyList<ReportInfo>> ListAsync(string chainId, string? playlistId, CancellationToken cancellationToken);

    public Task<Report?> FindAsync(string chainId, string id, CancellationToken cancellationToken);
}
