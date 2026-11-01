using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using YtPlaylist.Infrastructure.Persistence;

namespace YtPlaylist.Tests;

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
