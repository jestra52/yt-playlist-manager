using System.Text.Json.Serialization;

namespace YtPlaylist.Application.YouTube;

/// <summary>Public details of a YouTube video.</summary>
public sealed record VideoMetadata(
    [property: JsonPropertyName("youtubeId")] string YouTubeId,
    string Title,
    string Author,
    string ThumbnailUrl);

/// <summary>A public YouTube playlist and the videos the app imports.</summary>
/// <param name="Id"></param>
/// <param name="Title"></param>
/// <param name="Author"></param>
/// <param name="Videos"></param>
/// <param name="Skipped">Deleted or private videos left out.</param>
/// <param name="Partial">True when only part of the playlist could be read.</param>
/// <param name="Source">"api" (YouTube Data API) or "feed" (public feed).</param>
public sealed record YouTubePlaylist(
    string Id,
    string Title,
    string Author,
    IReadOnlyList<VideoMetadata> Videos,
    int Skipped,
    bool Partial,
    string Source);

/// <summary>Reads video titles and channels.</summary>
public interface IVideoMetadataSource
{
    /// <exception cref="YouTubeNotFoundException">For private, deleted or unknown videos.</exception>
    public Task<VideoMetadata> GetVideoAsync(string youTubeId, CancellationToken cancellationToken);
}

/// <summary>Reads public YouTube playlists.</summary>
public interface IYouTubePlaylistSource
{
    /// <exception cref="YouTubeNotFoundException">For private or unknown playlists.</exception>
    /// <exception cref="PlaylistNotSupportedException">For mixes and personal lists.</exception>
    public Task<YouTubePlaylist> GetPlaylistAsync(string playlistId, CancellationToken cancellationToken);
}

/// <summary>The video or playlist doesn't exist, is private, or can't be embedded. Answered with 404.</summary>
public sealed class YouTubeNotFoundException(string message) : Exception(message);

/// <summary>Mixes and personal lists such as Watch Later. Answered with 404.</summary>
public sealed class PlaylistNotSupportedException()
    : Exception("mixes and personal lists such as Watch Later can't be imported");

/// <summary>YouTube answered with an unexpected error. Answered with 502.</summary>
public sealed class YouTubeUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
