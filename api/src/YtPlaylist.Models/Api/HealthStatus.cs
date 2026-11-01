namespace YtPlaylist.Models.Api;

/// <summary>Body of GET /api/health: <c>{ "ok": true, "syncConfigured": … }</c>.</summary>
public sealed record HealthStatus(bool Ok, bool SyncConfigured);
