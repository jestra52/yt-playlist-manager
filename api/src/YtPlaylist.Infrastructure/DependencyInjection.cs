namespace YtPlaylist.Infrastructure;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using YtPlaylist.Application.Sync;
using YtPlaylist.Application.YouTube;
using YtPlaylist.Infrastructure.Persistence;
using YtPlaylist.Infrastructure.YouTube;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the database (when DATABASE_URL is set) and the YouTube clients.
    /// Without a database the API still serves video titles and playlist imports,
    /// and /api/sync answers 503.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var databaseUrl = configuration["DATABASE_URL"];
        if (!string.IsNullOrWhiteSpace(databaseUrl))
        {
            var connectionString = PostgresConnectionString.From(databaseUrl);
            services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
            services.AddScoped<ISyncStore, EfSyncStore>();
        }

        services.AddOptions<YouTubeOptions>()
            .Configure<IConfiguration>((options, config) => options.ApiKey = config["YOUTUBE_API_KEY"] ?? "");
        services.AddHttpClient<IVideoMetadataSource, OEmbedClient>(client => client.Timeout = TimeSpan.FromSeconds(8));
        services.AddHttpClient<IYouTubePlaylistSource, YouTubePlaylistClient>(
            client => client.Timeout = TimeSpan.FromSeconds(10));
        return services;
    }

    /// <summary>Applies pending EF Core migrations when a database is configured.</summary>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetService<AppDbContext>();
        if (db is not null)
        {
            await db.Database.MigrateAsync(cancellationToken);
        }
    }
}
