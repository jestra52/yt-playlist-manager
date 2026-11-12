using System.Reflection;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Models.Api;

namespace YtPlaylist.Api.Endpoints;

public static class HealthEndpoints
{
    /// <summary>The API's version, from api/VERSION at build time.</summary>
    public static readonly string Version =
        typeof(HealthEndpoints).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "";

    /// <summary>GET /api/health: used by the sync settings dialog and Render's health check.</summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var handler = (SyncService sync, ChainService chains, IConfiguration config) => Results.Json(new HealthStatus(
            Ok: true,
            SyncConfigured: sync.IsAvailable && chains.IsAvailable,
            Version: Version,
            MinAppVersion: AppVersionGate.Minimum(config)));
        app.MapGet("/api", handler);
        app.MapGet("/api/health", handler);
        return app;
    }
}
