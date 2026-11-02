using System.Text.Json.Serialization;

namespace YtPlaylist.Models.YouTube;

/// <summary>Public details of a YouTube video.</summary>
/// <param name="YouTubeId"></param>
/// <param name="Title"></param>
/// <param name="Author"></param>
/// <param name="ThumbnailUrl"></param>
/// <param name="Unavailable">
/// True for a playlist item YouTube still lists but that was deleted or made private
/// ("Deleted video", "Private video"): it has an ID but no channel or thumbnail.
/// </param>
public sealed record VideoMetadata(
    [property: JsonPropertyName("youtubeId")] string YouTubeId,
    string Title,
    string Author,
    string ThumbnailUrl,
    bool Unavailable = false);
