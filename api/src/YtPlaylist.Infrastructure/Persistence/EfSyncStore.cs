namespace YtPlaylist.Infrastructure.Persistence;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using YtPlaylist.Application.Sync;
using YtPlaylist.Domain.Common;
using YtPlaylist.Domain.Playlists;
using YtPlaylist.Domain.Videos;

/// <summary>Stores synced rows with Entity Framework Core.</summary>
/// <remarks>
/// Every write first locks the single <see cref="SyncCounter"/> row. That serializes
/// sync writes, so change numbers (<c>seq</c>) are committed in increasing order and a
/// device that pulled up to a cursor never misses a row committed later.
/// </remarks>
public sealed class EfSyncStore(AppDbContext db) : ISyncStore
{
    public async Task<int> ApplyAsync(ChangeSet changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (changes.Count == 0)
        {
            return 0;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var seq = await this.LockCounterAsync(transaction, cancellationToken);
        var applied = 0;

        var playlistIds = changes.Playlists.Select(p => p.Id).Distinct().ToList();
        var playlists = await db.Playlists
            .Where(p => playlistIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);
        foreach (var change in changes.Playlists)
        {
            if (playlists.TryGetValue(change.Id, out var row))
            {
                // Last write wins: an older or equal edit never replaces the stored row.
                if (change.UpdatedAt <= row.UpdatedAt)
                {
                    continue;
                }
            }
            else
            {
                row = new Playlist { Id = change.Id, CreatedAt = change.CreatedAt };
                db.Playlists.Add(row);
                playlists[change.Id] = row;
            }
            row.Name = change.Name;
            row.Description = change.Description;
            row.Position = change.Position;
            row.UpdatedAt = change.UpdatedAt;
            row.Deleted = change.Deleted;
            row.Seq = ++seq;
            applied++;
        }

        var videoIds = changes.Videos.Select(v => v.Id).Distinct().ToList();
        var videos = await db.Videos
            .Where(v => videoIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);
        foreach (var change in changes.Videos)
        {
            if (videos.TryGetValue(change.Id, out var row))
            {
                if (change.UpdatedAt <= row.UpdatedAt)
                {
                    continue;
                }
            }
            else
            {
                row = new Video
                {
                    Id = change.Id,
                    PlaylistId = change.PlaylistId,
                    YouTubeId = change.YouTubeId,
                    CreatedAt = change.CreatedAt,
                };
                db.Videos.Add(row);
                videos[change.Id] = row;
            }
            row.PlaylistId = change.PlaylistId;
            row.YouTubeId = change.YouTubeId;
            row.Title = change.Title;
            row.Author = change.Author;
            row.ThumbnailUrl = change.ThumbnailUrl;
            row.Notes = change.Notes;
            row.Watched = change.Watched;
            row.Position = change.Position;
            row.UpdatedAt = change.UpdatedAt;
            row.Deleted = change.Deleted;
            row.Seq = ++seq;
            applied++;
        }

        await db.SyncCounters
            .Where(c => c.Id == SyncCounter.SingletonId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(c => c.Value, seq), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        db.ChangeTracker.Clear();
        return applied;
    }

    public async Task<ChangePage> GetChangesAsync(long since, int limit, CancellationToken cancellationToken)
    {
        if (limit is <= 0 or > SyncLimits.MaxPullPageSize)
        {
            limit = SyncLimits.MaxPullPageSize;
        }

        var playlists = await db.Playlists
            .AsNoTracking()
            .Where(p => p.Seq > since)
            .OrderBy(p => p.Seq)
            .Take(limit)
            .ToListAsync(cancellationToken);
        var videos = await db.Videos
            .AsNoTracking()
            .Where(v => v.Seq > since)
            .OrderBy(v => v.Seq)
            .Take(limit)
            .ToListAsync(cancellationToken);

        // Merge both tables by change number and keep the oldest `limit` rows.
        var merged = playlists.Select(p => (p.Seq, Playlist: (Playlist?)p, Video: (Video?)null))
            .Concat(videos.Select(v => (v.Seq, Playlist: (Playlist?)null, Video: (Video?)v)))
            .OrderBy(item => item.Seq)
            .ToList();
        var hasMore = playlists.Count == limit || videos.Count == limit || merged.Count > limit;
        var page = merged.Take(limit).ToList();

        var changes = new ChangeSet
        {
            Playlists = [.. page.Where(i => i.Playlist is not null).Select(i => ToChange(i.Playlist!))],
            Videos = [.. page.Where(i => i.Video is not null).Select(i => ToChange(i.Video!))],
        };
        var cursor = page.Count > 0 ? page[^1].Seq : since;
        return new ChangePage(changes, cursor, hasMore);
    }

    /// <summary>
    /// Locks the counter row for the rest of the transaction and returns its value.
    /// <c>UPDATE … RETURNING</c> works on PostgreSQL and SQLite (used in tests).
    /// </summary>
    private async Task<long> LockCounterAsync(IDbContextTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = transaction.GetDbTransaction();
        command.CommandText = "UPDATE sync_counter SET value = value WHERE id = "
            + SyncCounter.SingletonId.ToString(CultureInfo.InvariantCulture)
            + " RETURNING value";
        var value = await command.ExecuteScalarAsync(cancellationToken)
            ?? throw new InvalidOperationException("The sync_counter row is missing. Run the database migrations.");
        return Convert.ToInt64(value, CultureInfo.InvariantCulture);
    }

    private static PlaylistChange ToChange(Playlist p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Position = p.Position,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        Deleted = p.Deleted,
    };

    private static VideoChange ToChange(Video v) => new()
    {
        Id = v.Id,
        PlaylistId = v.PlaylistId,
        YouTubeId = v.YouTubeId,
        Title = v.Title,
        Author = v.Author,
        ThumbnailUrl = v.ThumbnailUrl,
        Notes = v.Notes,
        Watched = v.Watched,
        Position = v.Position,
        CreatedAt = v.CreatedAt,
        UpdatedAt = v.UpdatedAt,
        Deleted = v.Deleted,
    };
}
