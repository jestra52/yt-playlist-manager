using Microsoft.EntityFrameworkCore;
using YtPlaylist.Infrastructure.Persistence;
using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Sync;

namespace YtPlaylist.Tests;

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
        // Retries on, as the API sets it up, so the store's own transaction runs inside
        // the retrying execution strategy (which refuses a transaction opened outside it).
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresConnectionString.From(DatabaseUrl), npgsql => npgsql.EnableRetryOnFailure())
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
        await using (var setup = this.CreateContext()!)
        {
            await new EfChainStore(setup).CreateChainAsync(
                new SyncChain { Id = run, SecretHash = $"h{run}", CreatedAt = 1 },
                new SyncDevice { Id = $"d{run}", ChainId = run, CredentialHash = $"k{run}", Name = "Test", CreatedAt = 1 },
                CancellationToken.None);
        }
        var writers = Enumerable.Range(0, 8).Select(async i =>
        {
            await using var db = this.CreateContext()!;
            var change = new PlaylistChange { Id = $"{run}-{i}", Name = $"P{i}", CreatedAt = 1, UpdatedAt = 1 };
            return await new EfSyncStore(db).ApplyAsync(run, new ChangeSet { Playlists = [change] }, CancellationToken.None);
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
