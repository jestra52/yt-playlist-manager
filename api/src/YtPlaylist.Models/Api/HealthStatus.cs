namespace YtPlaylist.Models.Api;

/// <summary>
/// Body of GET /api/health: <c>{ "ok": true, "syncConfigured": …, "version": "0.1.0", "minAppVersion": "0.0.0" }</c>.
/// <c>minAppVersion</c> is the oldest app version that can sync with this API.
/// </summary>
public sealed record HealthStatus(bool Ok, bool SyncConfigured, string Version, string MinAppVersion);
