namespace YtPlaylist.Tests;

using Microsoft.EntityFrameworkCore;
using YtPlaylist.Infrastructure.Persistence;

public sealed class MigrationTests
{
    /// <summary>
    /// Fails when the entity configuration changed without a new migration
    /// (run `dotnet ef migrations add &lt;Name&gt;` in api/). Needs no database.
    /// </summary>
    [Fact]
    public void MigrationsMatchTheModel()
    {
        using var db = new AppDbContextFactory().CreateDbContext([]);
        Assert.False(db.Database.HasPendingModelChanges());
        Assert.Contains(db.Database.GetMigrations(), id => id.EndsWith("_InitialCreate", StringComparison.Ordinal));
    }
}
