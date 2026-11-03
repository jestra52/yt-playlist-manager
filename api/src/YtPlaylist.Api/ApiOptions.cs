namespace YtPlaylist.Api;

/// <summary>Settings read from the environment.</summary>
public sealed class ApiOptions
{
    /// <summary>
    /// SYNC_TOKEN: the shared secret devices synced with before sync chains. It's only used
    /// once, to claim that library as a sync chain (POST /api/chains/claim); remove it after.
    /// </summary>
    public string SyncToken { get; set; } = "";
}
