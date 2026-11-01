using System.Text.Json.Serialization;

namespace YtPlaylist.Application.YouTube;

/// <summary>Public details of a YouTube video.</summary>
public sealed record VideoMetadata(
    [property: JsonPropertyName("youtubeId")] string YouTubeId,
    string Title,
    string Author,
    string ThumbnailUrl);
