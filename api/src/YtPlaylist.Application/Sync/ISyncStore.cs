using YtPlaylist.Models.Sync;

namespace YtPlaylist.Application.Sync;

/// <summary>Cloud storage for synced rows (implemented with Entity Framework Core), one sync chain at a time.</summary>
public interface ISyncStore
{
    /// <summary>
    /// Writes the changes into <paramref name="chainId"/> atomically with last-write-wins: a row
    /// only replaces the stored one when its UpdatedAt is newer. A row whose ID belongs to another
    /// chain is never touched. Returns how many rows were written.
    /// </summary>
    public Task<int> ApplyAsync(string chainId, ChangeSet changes, CancellationToken cancellationToken);

    /// <summary>
    /// The chain's rows changed after <paramref name="since"/>, oldest first, at most <paramref name="limit"/>.
    /// </summary>
    public Task<ChangePage> GetChangesAsync(string chainId, long since, int limit, CancellationToken cancellationToken);
}
