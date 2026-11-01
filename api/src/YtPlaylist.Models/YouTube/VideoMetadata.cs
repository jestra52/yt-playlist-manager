using System.Text.Json.Serialization;

namespace YtPlaylist.Models.YouTube;

/// <summary>Public details of a YouTube video.</summary>
public sealed record VideoMetadata(
    [property: JsonPropertyName("youtubeId")] string YouTubeId,
    string Title,
    string Author,
    string ThumbnailUrl);
