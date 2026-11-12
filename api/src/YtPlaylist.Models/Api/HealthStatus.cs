namespace YtPlaylist.Models.Api;

/// <summary>Body of GET /api/health: <c>{ "ok": true, "syncConfigured": …, "version": "0.1.0" }</c>.</summary>
public sealed record HealthStatus(bool Ok, bool SyncConfigured, string Version);
