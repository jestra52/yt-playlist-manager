using Microsoft.EntityFrameworkCore;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Sync;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Stores synced rows with Entity Framework Core, scoped to one sync chain per call.</summary>
/// <remarks>
/// Every write first locks the single <see cref="SyncCounter"/> row. That serializes
/// sync writes, so change numbers (<c>seq</c>) are committed in increasing order and a
/// device that pulled up to a cursor never misses a row committed later. Change numbers
/// are shared by every chain; each chain only ever reads its own rows.
/// </remarks>
public sealed class EfSyncStore(AppDbContext db) : ISyncStore
{
    public async Task<int> ApplyAsync(string chainId, ChangeSet changes, string? deviceId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(chainId);
        ArgumentNullException.ThrowIfNull(changes);
        if (changes.Count == 0)
        {
            return 0;
        }

        // The retrying execution strategy (see DependencyInjection) runs the whole
        // transaction again when the connection drops. A replay is safe: rows whose
        // updatedAt is already stored are skipped (last-write-wins).
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            return await this.ApplyOnceAsync(chainId, changes, deviceId, cancellationToken);
        });
    }

    private async Task<int> ApplyOnceAsync(
        string chainId, ChangeSet changes, string? deviceId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var seq = await SyncCounterLock.LockAsync(db, cancellationToken);

        // Checked under the lock: once the recovery hook (or a removal) has committed, a device
        // it removed can't write anymore, even if its request was authenticated just before.
        if (deviceId is not null && !await db.SyncDevices.AnyAsync(d => d.Id == deviceId && d.ChainId == chainId, cancellationToken))
        {
            throw new DeviceRemovedException();
        }
        var applied = 0;

        var playlistIds = changes.Playlists.Select(p => p.Id).Distinct().ToList();
        var playlists = await db.Playlists
            .Where(p => p.ChainId == chainId && playlistIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);
        foreach (var change in changes.Playlists)
        {
            if (playlists.TryGetValue(change.Id, out var row))
            {
                if (change.UpdatedAt <= row.UpdatedAt)
                {
                    continue;
                }
            }
            else
            {
                row = new Playlist { Id = change.Id, ChainId = chainId, CreatedAt = change.CreatedAt };
                db.Playlists.Add(row);
                playlists[change.Id] = row;
            }
            row.Name = change.Name;
            row.Description = change.Description;
            if (change.Source is not null)
            {
                row.Source = change.Source;
                row.SourceId = change.SourceId ?? "";
            }
            row.Position = change.Position;
            row.UpdatedAt = change.UpdatedAt;
            row.Deleted = change.Deleted;
            row.Seq = ++seq;
            applied++;
        }

        var videoIds = changes.Videos.Select(v => v.Id).Distinct().ToList();
        var videos = await db.Videos
            .Where(v => v.ChainId == chainId && videoIds.Contains(v.Id))
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
                    ChainId = chainId,
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
            if (change.Artist is not null)
            {
                row.Artist = change.Artist;
                row.ArtistSource = change.ArtistSource ?? "";
            }
            row.ThumbnailUrl = change.ThumbnailUrl;
            row.Notes = change.Notes;
            row.Watched = change.Watched;
            if (change.Unavailable is { } unavailable)
            {
                row.Unavailable = unavailable;
            }
            if (change.ReplacedYouTubeId is { } replacedYouTubeId)
            {
                row.ReplacedYouTubeId = replacedYouTubeId;
            }
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

    public async Task<ChangePage> GetChangesAsync(string chainId, long since, int limit, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(chainId);
        if (limit is <= 0 or > SyncLimits.MaxPullPageSize)
        {
            limit = SyncLimits.MaxPullPageSize;
        }

        var playlists = await db.Playlists
            .AsNoTracking()
            .Where(p => p.ChainId == chainId && p.Seq > since)
            .OrderBy(p => p.Seq)
            .Take(limit)
            .ToListAsync(cancellationToken);
        var videos = await db.Videos
            .AsNoTracking()
            .Where(v => v.ChainId == chainId && v.Seq > since)
            .OrderBy(v => v.Seq)
            .Take(limit)
            .ToListAsync(cancellationToken);

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

    private static PlaylistChange ToChange(Playlist p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Source = p.Source,
        SourceId = p.SourceId,
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
        Artist = v.Artist,
        ArtistSource = v.ArtistSource,
        ThumbnailUrl = v.ThumbnailUrl,
        Notes = v.Notes,
        Watched = v.Watched,
        Unavailable = v.Unavailable,
        ReplacedYouTubeId = v.ReplacedYouTubeId,
        Position = v.Position,
        CreatedAt = v.CreatedAt,
        UpdatedAt = v.UpdatedAt,
        Deleted = v.Deleted,
    };
}
