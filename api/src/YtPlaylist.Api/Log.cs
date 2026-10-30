namespace YtPlaylist.Api;

/// <summary>The API's log messages, generated at compile time for speed (CA1848).</summary>
internal static partial class Log
{
    [LoggerMessage(Level = LogLevel.Error, Message = "Sync failed")]
    public static partial void SyncFailed(this ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "oEmbed lookup for {VideoId} failed")]
    public static partial void OEmbedLookupFailed(this ILogger logger, Exception exception, string? videoId);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Playlist {PlaylistId} could not be read")]
    public static partial void PlaylistReadFailed(this ILogger logger, Exception exception, string? playlistId);
}
