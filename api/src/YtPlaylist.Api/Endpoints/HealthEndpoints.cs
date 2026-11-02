using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Models.Api;

namespace YtPlaylist.Api.Endpoints;

public static class HealthEndpoints
{
    /// <summary>GET /api/health: used by the sync settings dialog and Render's health check.</summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var handler = (SyncService sync, ChainService chains) => Results.Json(new HealthStatus(
            Ok: true,
            SyncConfigured: sync.IsAvailable && chains.IsAvailable));
        app.MapGet("/api", handler);
        app.MapGet("/api/health", handler);
        return app;
    }
}
