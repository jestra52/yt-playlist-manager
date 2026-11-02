using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Application.YouTube;
using YtPlaylist.Infrastructure.Persistence;
using YtPlaylist.Infrastructure.YouTube;

namespace YtPlaylist.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the database (when DATABASE_URL is set), the sync chain secrets
    /// (SYNC_PEPPER) and the YouTube clients. Without a database or a pepper the API
    /// still serves video titles and playlist imports, and sync answers 503.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var databaseUrl = configuration["DATABASE_URL"];
        if (!string.IsNullOrWhiteSpace(databaseUrl))
        {
            var connectionString = PostgresConnectionString.From(databaseUrl);
            // Neon closes idle connections when the database pauses or restarts
            // (57P01 "terminating connection due to administrator command"), so a
            // pooled connection can be dead by the next request: retry on a fresh one.
            services.AddDbContext<AppDbContext>(
                options => options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure()));
            services.AddScoped<ISyncStore, EfSyncStore>();
            services.AddScoped<IChainStore, EfChainStore>();
        }

        services.AddOptions<ChainSecurityOptions>()
            .Configure<IConfiguration>((options, config) => options.Pepper = config["SYNC_PEPPER"] ?? "");
        services.AddSingleton<ISecretHasher, HmacSecretHasher>();

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
