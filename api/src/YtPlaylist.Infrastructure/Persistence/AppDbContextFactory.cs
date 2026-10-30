namespace YtPlaylist.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

/// <summary>
/// Lets <c>dotnet ef</c> build the model without starting the API. Creating
/// migrations doesn't connect to the database; applying them uses DATABASE_URL.
/// </summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var url = Environment.GetEnvironmentVariable("DATABASE_URL");
        var connectionString = string.IsNullOrWhiteSpace(url)
            ? "Host=localhost;Database=ytplaylist;Username=postgres;Password=postgres"
            : PostgresConnectionString.From(url);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options;
        return new AppDbContext(options);
    }
}
