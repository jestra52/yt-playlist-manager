namespace YtPlaylist.Application.Sync;

/// <summary>Cloud storage for synced rows (implemented with Entity Framework Core).</summary>
public interface ISyncStore
{
    /// <summary>
    /// Writes the changes atomically with last-write-wins: a row only replaces the
    /// stored one when its UpdatedAt is newer. Returns how many rows were written.
    /// </summary>
    Task<int> ApplyAsync(ChangeSet changes, CancellationToken cancellationToken);

    /// <summary>Rows changed after <paramref name="since"/>, oldest first, at most <paramref name="limit"/>.</summary>
    Task<ChangePage> GetChangesAsync(long since, int limit, CancellationToken cancellationToken);
}
