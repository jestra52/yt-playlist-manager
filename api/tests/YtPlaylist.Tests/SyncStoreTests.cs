using Microsoft.EntityFrameworkCore;
using YtPlaylist.Infrastructure.Persistence;
using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Sync;

namespace YtPlaylist.Tests;

/// <summary>
/// Sync and chain store behaviour, run against SQLite in memory and, when TEST_DATABASE_URL
/// is set (as in CI), against PostgreSQL with the real migrations. Every test works in sync
/// chains of its own, so tests sharing a PostgreSQL database don't see each other's rows.
/// </summary>
public abstract class SyncStoreTests
{
    /// <summary>A new context on the test database, or null when this database isn't available.</summary>
    protected abstract AppDbContext? CreateContext();

    private static string NewId(string prefix) => $"{prefix}{Guid.NewGuid():N}"[..24];

    /// <summary>Creates a chain with one device and returns their IDs.</summary>
    private static async Task<(string ChainId, string DeviceId)> NewChainAsync(AppDbContext db)
    {
        var chain = new SyncChain { Id = NewId("c"), SecretHash = NewId("h"), CreatedAt = 1 };
        var device = new SyncDevice { Id = NewId("d"), ChainId = chain.Id, CredentialHash = NewId("k"), Name = "Test", CreatedAt = 1 };
        await new EfChainStore(db).CreateChainAsync(chain, device, CancellationToken.None);
        return (chain.Id, device.Id);
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
        var (chain, _) = await NewChainAsync(db);
        var run = NewId("t");

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
        Assert.Equal(2, await store.ApplyAsync(chain, new ChangeSet { Playlists = [playlist], Videos = [video] }, CancellationToken.None));

        var stale = playlist with { Name = "Stale", UpdatedAt = 50 };
        var newer = video with { Watched = true, UpdatedAt = 200 };
        Assert.Equal(1, await store.ApplyAsync(chain, new ChangeSet { Playlists = [stale], Videos = [newer] }, CancellationToken.None));

        var all = await store.GetChangesAsync(chain, 0, 1000, CancellationToken.None);
        Assert.False(all.HasMore);
        Assert.True(all.Cursor > 0);
        var storedPlaylist = Assert.Single(all.Changes.Playlists);
        Assert.Equal("Original", storedPlaylist.Name);
        var storedVideo = Assert.Single(all.Changes.Videos);
        Assert.True(storedVideo.Watched);
        Assert.Equal(video.Title, storedVideo.Title);
        Assert.Equal(1.5, storedVideo.Position);

        var first = await store.GetChangesAsync(chain, 0, 1, CancellationToken.None);
        Assert.True(first.HasMore);
        Assert.Single(first.Changes.Playlists);
        Assert.Empty(first.Changes.Videos);
        var second = await store.GetChangesAsync(chain, first.Cursor, 1, CancellationToken.None);
        Assert.Single(second.Changes.Videos);
        Assert.Equal(all.Cursor, second.Cursor);

        var none = await store.GetChangesAsync(chain, all.Cursor, 1000, CancellationToken.None);
        Assert.Equal(0, none.Changes.Count);
        Assert.Equal(all.Cursor, none.Cursor);
    }

    [Fact]
    public async Task StoresTheArtistAndKeepsItWhenAnOlderAppLeavesItOut()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var store = new EfSyncStore(db);
        var (chain, _) = await NewChainAsync(db);
        var run = NewId("a");

        var video = new VideoChange
        {
            Id = $"{run}-v",
            PlaylistId = $"{run}-p",
            YouTubeId = "dQw4w9WgXcQ",
            Title = "Windy Summer",
            Artist = "杏里",
            ArtistSource = "user",
            CreatedAt = 1,
            UpdatedAt = 1,
        };
        await store.ApplyAsync(chain, new ChangeSet { Videos = [video] }, CancellationToken.None);
        var fromOlderApp = video with { Artist = null, ArtistSource = null, Watched = true, UpdatedAt = 2 };
        await store.ApplyAsync(chain, new ChangeSet { Videos = [fromOlderApp] }, CancellationToken.None);

        var stored = Assert.Single((await store.GetChangesAsync(chain, 0, 1000, CancellationToken.None)).Changes.Videos);
        Assert.True(stored.Watched);
        Assert.Equal("杏里", stored.Artist);
        Assert.Equal("user", stored.ArtistSource);
    }

    [Fact]
    public async Task StoresThePlaylistSourceAndUnavailableVideosAndKeepsThemForOlderApps()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var store = new EfSyncStore(db);
        var (chain, _) = await NewChainAsync(db);
        var run = NewId("s");

        var playlist = new PlaylistChange
        {
            Id = $"{run}-p",
            Name = "Road trip",
            Source = "youtube",
            SourceId = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
            CreatedAt = 1,
            UpdatedAt = 1,
        };
        var video = new VideoChange
        {
            Id = $"{run}-v",
            PlaylistId = playlist.Id,
            YouTubeId = "aaaaaaaaaaa",
            Title = "Deleted video",
            Unavailable = true,
            CreatedAt = 1,
            UpdatedAt = 1,
        };
        await store.ApplyAsync(chain, new ChangeSet { Playlists = [playlist], Videos = [video] }, CancellationToken.None);
        var fromOlderApp = new ChangeSet
        {
            Playlists = [playlist with { Name = "Renamed", Source = null, SourceId = null, UpdatedAt = 2 }],
            Videos = [video with { Watched = true, Unavailable = null, UpdatedAt = 2 }],
        };
        await store.ApplyAsync(chain, fromOlderApp, CancellationToken.None);

        var page = await store.GetChangesAsync(chain, 0, 1000, CancellationToken.None);
        var storedPlaylist = Assert.Single(page.Changes.Playlists);
        Assert.Equal(("Renamed", "youtube", "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"), (storedPlaylist.Name, storedPlaylist.Source, storedPlaylist.SourceId));
        var storedVideo = Assert.Single(page.Changes.Videos);
        Assert.True(storedVideo.Watched);
        Assert.True(storedVideo.Unavailable);
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
        var (chain, _) = await NewChainAsync(db);
        var id = NewId("d");

        await store.ApplyAsync(chain, new ChangeSet { Playlists = [new() { Id = id, Name = "Temp", CreatedAt = 1, UpdatedAt = 1 }] }, CancellationToken.None);
        await store.ApplyAsync(chain, new ChangeSet { Playlists = [new() { Id = id, Name = "Temp", CreatedAt = 1, UpdatedAt = 2, Deleted = true }] }, CancellationToken.None);

        var page = await store.GetChangesAsync(chain, 0, 1000, CancellationToken.None);
        var row = Assert.Single(page.Changes.Playlists);
        Assert.True(row.Deleted);
    }

    [Fact]
    public async Task KeepsEachChainsRowsApart()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var store = new EfSyncStore(db);
        var (mine, _) = await NewChainAsync(db);
        var (theirs, _) = await NewChainAsync(db);
        var id = NewId("p");

        await store.ApplyAsync(mine, new ChangeSet { Playlists = [new() { Id = id, Name = "Mine", CreatedAt = 1, UpdatedAt = 1 }] }, CancellationToken.None);

        // Another chain can't read the row, nor overwrite it by sending the same ID with a newer time.
        Assert.Equal(0, (await store.GetChangesAsync(theirs, 0, 1000, CancellationToken.None)).Changes.Count);
        var hijack = new ChangeSet { Playlists = [new() { Id = id, Name = "Theirs", CreatedAt = 1, UpdatedAt = 99 }] };
        Assert.Equal(0, await store.ApplyAsync(theirs, hijack, CancellationToken.None));
        Assert.Equal("Mine", Assert.Single((await store.GetChangesAsync(mine, 0, 1000, CancellationToken.None)).Changes.Playlists).Name);
        Assert.Equal(0, (await store.GetChangesAsync(theirs, 0, 1000, CancellationToken.None)).Changes.Count);
    }

    [Fact]
    public async Task ManagesDevicesAndReplacesAChainsSecret()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var chains = new EfChainStore(db);
        var (chain, first) = await NewChainAsync(db);
        var second = new SyncDevice { Id = NewId("d"), ChainId = chain, CredentialHash = NewId("k"), Name = "Phone", CreatedAt = 2 };
        await chains.AddDeviceAsync(second, CancellationToken.None);
        Assert.Equal([first, second.Id], (await chains.ListDevicesAsync(chain, CancellationToken.None)).Select(d => d.Id));
        Assert.Equal(chain, (await chains.FindDeviceByCredentialHashAsync(second.CredentialHash, CancellationToken.None))?.ChainId);

        var newHash = NewId("h");
        await chains.ReplaceSecretAsync(chain, newHash, first, CancellationToken.None);
        Assert.Equal(chain, (await chains.FindChainBySecretHashAsync(newHash, CancellationToken.None))?.Id);
        Assert.Equal([first], (await chains.ListDevicesAsync(chain, CancellationToken.None)).Select(d => d.Id));
        Assert.Null(await chains.FindDeviceByCredentialHashAsync(second.CredentialHash, CancellationToken.None));

        await chains.TouchDeviceAsync(first, 12345, CancellationToken.None);
        Assert.Equal(12345, Assert.Single(await chains.ListDevicesAsync(chain, CancellationToken.None)).LastSeenAt);
        Assert.False(await chains.RemoveDeviceAsync(NewId("c"), first, CancellationToken.None));
        Assert.True(await chains.RemoveDeviceAsync(chain, first, CancellationToken.None));
    }

    [Fact]
    public async Task DeletingAChainDeletesItsDevicesAndData()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        var store = new EfSyncStore(db);
        var (chain, _) = await NewChainAsync(db);
        var (other, _) = await NewChainAsync(db);
        var run = NewId("x");
        var changes = new ChangeSet
        {
            Playlists = [new() { Id = $"{run}-p", Name = "Gone", CreatedAt = 1, UpdatedAt = 1 }],
            Videos = [new() { Id = $"{run}-v", PlaylistId = $"{run}-p", YouTubeId = "dQw4w9WgXcQ", CreatedAt = 1, UpdatedAt = 1 }],
        };
        await store.ApplyAsync(chain, changes, CancellationToken.None);
        await store.ApplyAsync(other, new ChangeSet { Playlists = [new() { Id = $"{run}-o", Name = "Kept", CreatedAt = 1, UpdatedAt = 1 }] }, CancellationToken.None);

        await new EfChainStore(db).DeleteChainAsync(chain, CancellationToken.None);

        Assert.False(await db.SyncChains.AnyAsync(c => c.Id == chain));
        Assert.False(await db.SyncDevices.AnyAsync(d => d.ChainId == chain));
        Assert.False(await db.Playlists.AnyAsync(p => p.ChainId == chain));
        Assert.False(await db.Videos.AnyAsync(v => v.ChainId == chain));
        Assert.Single((await store.GetChangesAsync(other, 0, 1000, CancellationToken.None)).Changes.Playlists);
    }

    [Fact]
    public async Task TheLegacyChainCanBeClaimedOnlyOnce()
    {
        await using var db = this.CreateContext();
        if (db is null)
        {
            return;
        }
        if (await db.SyncChains.AnyAsync(c => c.Id == SyncChain.LegacyId && c.SecretHash != null))
        {
            return; // already claimed by an earlier run on a shared database
        }
        var chains = new EfChainStore(db);
        static SyncDevice Device() => new() { Id = NewId("d"), ChainId = SyncChain.LegacyId, CredentialHash = NewId("k"), Name = "Old laptop", CreatedAt = 1 };

        var hash = NewId("h");
        Assert.True(await chains.ClaimLegacyChainAsync(hash, Device(), CancellationToken.None));
        Assert.Equal(SyncChain.LegacyId, (await chains.FindChainBySecretHashAsync(hash, CancellationToken.None))?.Id);
        Assert.False(await chains.ClaimLegacyChainAsync(NewId("h"), Device(), CancellationToken.None));
        Assert.Single(await chains.ListDevicesAsync(SyncChain.LegacyId, CancellationToken.None));
    }
}
