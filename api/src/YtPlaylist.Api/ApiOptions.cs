namespace YtPlaylist.Api;

/// <summary>Settings read from the environment.</summary>
public sealed class ApiOptions
{
    /// <summary>SYNC_TOKEN: shared secret the web app sends as a bearer token to /api/sync.</summary>
    public string SyncToken { get; set; } = "";
}
