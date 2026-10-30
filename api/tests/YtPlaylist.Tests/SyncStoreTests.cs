using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using YtPlaylist.Application.Sync;
using YtPlaylist.Infrastructure.Persistence;

namespace YtPlaylist.Tests;

/// <summary>
/// Sync store behaviour, run against SQLite in memory and, when TEST_DATABASE_URL is
/// set (as in CI), against PostgreSQL with the real migrations.
/// </summary>
public abstract class SyncStoreTests
{
    /// <summary>A new context on the test database, or null when this database isn't available.</summary>
    protected abstract AppDbContext? CreateContext();

    private static async Task<long> HeadAsync(EfSyncStore store)
    {
        long head = 0;
        while (true)
        {
            var page = await store.GetChangesAsync(head, 1000, CancellationToken.None);
            head = page.Cursor;
            if (!page.HasMore)
            {
                return head;
            }
        }
    }

    [Fact]
    public async Task AppliesLastWriteWinsAndPagesInOrder()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var store = new EfSyncStore(db);
        var head = await HeadAsync(store);
        var run = $"t{Guid.NewGuid():N}"[..20];

        var playlist = new PlaylistChange { Id = $"{run}-p", Name = "Original", CreatedAt = 100, UpdatedAt = 100 };
        var video = new VideoChange
        {
            Id = $"{run}-v",
            PlaylistId = playlist.Id,
            YouTubeId = "dQw4w9WgXcQ",
            Title = "It's \"quoted\" ✓",
            Position = 1.5,
            CreatedAt = 100,
            UpdatedAt = 100,
        };
        Assert.Equal(2, await store.ApplyAsync(new ChangeSet { Playlists = [playlist], Videos = [video] }, CancellationToken.None));

        // An older playlist edit loses; a newer video edit wins.
        var stale = playlist with { Name = "Stale", UpdatedAt = 50 };
        var newer = video with { Watched = true, UpdatedAt = 200 };
        Assert.Equal(1, await store.ApplyAsync(new ChangeSet { Playlists = [stale], Videos = [newer] }, CancellationToken.None));

        var all = await store.GetChangesAsync(head, 1000, CancellationToken.None);
        Assert.False(all.HasMore);
        Assert.True(all.Cursor > head);
        var storedPlaylist = Assert.Single(all.Changes.Playlists);
        Assert.Equal("Original", storedPlaylist.Name);
        var storedVideo = Assert.Single(all.Changes.Videos);
        Assert.True(storedVideo.Watched);
        Assert.Equal(video.Title, storedVideo.Title);
        Assert.Equal(1.5, storedVideo.Position);

        // The video changed after the playlist, so a page of one returns the playlist first.
        var first = await store.GetChangesAsync(head, 1, CancellationToken.None);
        Assert.True(first.HasMore);
        Assert.Single(first.Changes.Playlists);
        Assert.Empty(first.Changes.Videos);
        var second = await store.GetChangesAsync(first.Cursor, 1, CancellationToken.None);
        Assert.Single(second.Changes.Videos);
        Assert.Equal(all.Cursor, second.Cursor);

        // Nothing new after the cursor.
        var none = await store.GetChangesAsync(all.Cursor, 1000, CancellationToken.None);
        Assert.Equal(0, none.Changes.Count);
        Assert.Equal(all.Cursor, none.Cursor);
    }

    [Fact]
    public async Task SyncsDeletionsAsTombstones()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var store = new EfSyncStore(db);
        var head = await HeadAsync(store);
        var id = $"d{Guid.NewGuid():N}"[..20];

        await store.ApplyAsync(new ChangeSet { Playlists = [new() { Id = id, Name = "Temp", CreatedAt = 1, UpdatedAt = 1 }] }, CancellationToken.None);
        await store.ApplyAsync(new ChangeSet { Playlists = [new() { Id = id, Name = "Temp", CreatedAt = 1, UpdatedAt = 2, Deleted = true }] }, CancellationToken.None);

        var page = await store.GetChangesAsync(head, 1000, CancellationToken.None);
        var row = Assert.Single(page.Changes.Playlists);
        Assert.True(row.Deleted);
    }
}

public sealed class SqliteSyncStoreTests : SyncStoreTests, IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");

    public SqliteSyncStoreTests()
    {
        this.connection.Open();
        using var db = this.CreateContext();
        db.Database.EnsureCreated();
    }

    protected override AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(this.connection).Options);

    public void Dispose() => this.connection.Dispose();
}

public sealed class PostgresSyncStoreTests : SyncStoreTests
{
    private static readonly string? DatabaseUrl = Environment.GetEnvironmentVariable("TEST_DATABASE_URL");
    private static readonly Lock MigrateLock = new();
    private static bool migrated;

    protected override AppDbContext? CreateContext()
    {
        if (string.IsNullOrWhiteSpace(DatabaseUrl))
        {
            return null;
        }
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresConnectionString.From(DatabaseUrl))
            .Options);
        lock (MigrateLock)
        {
            if (!migrated)
            {
                db.Database.Migrate();
                migrated = true;
            }
        }
        return db;
    }

    [Fact]
    public async Task ConcurrentSyncsGetDistinctChangeNumbers()
    {
        if (string.IsNullOrWhiteSpace(DatabaseUrl))
        {
            return;
        }
        var run = $"c{Guid.NewGuid():N}"[..20];
        var writers = Enumerable.Range(0, 8).Select(async i =>
        {
            await using var db = this.CreateContext()!;
            var change = new PlaylistChange { Id = $"{run}-{i}", Name = $"P{i}", CreatedAt = 1, UpdatedAt = 1 };
            return await new EfSyncStore(db).ApplyAsync(new ChangeSet { Playlists = [change] }, CancellationToken.None);
        });
        Assert.All(await Task.WhenAll(writers), applied => Assert.Equal(1, applied));

        await using var check = this.CreateContext()!;
        var seqs = await check.Playlists
            .Where(p => p.Id.StartsWith(run))
            .Select(p => p.Seq)
            .ToListAsync();
        Assert.Equal(8, seqs.Count);
        Assert.Equal(8, seqs.Distinct().Count());
    }
}
