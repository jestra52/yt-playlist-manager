using System.Text.Json.Serialization;

namespace YtPlaylist.Models.YouTube.OEmbed;

/// <summary>The parts of YouTube's oEmbed response the app reads.</summary>
public sealed record OEmbedResponse(
    [property: JsonPropertyName("title")] string? Title,
    [property: JsonPropertyName("author_name")] string? AuthorName,
    [property: JsonPropertyName("thumbnail_url")] string? ThumbnailUrl);
