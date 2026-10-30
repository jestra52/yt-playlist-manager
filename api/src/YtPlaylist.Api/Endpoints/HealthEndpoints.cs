namespace YtPlaylist.Api.Endpoints;

using Microsoft.Extensions.Options;
using YtPlaylist.Application.Sync;

public static class HealthEndpoints
{
    /// <summary>GET /api/health: used by the sync settings dialog and Render's health check.</summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var handler = (SyncService sync, IOptions<ApiOptions> options) => Results.Json(new
        {
            ok = true,
            syncConfigured = sync.IsAvailable && options.Value.SyncToken.Length > 0,
        });
        app.MapGet("/api", handler);
        app.MapGet("/api/health", handler);
        return app;
    }
}
