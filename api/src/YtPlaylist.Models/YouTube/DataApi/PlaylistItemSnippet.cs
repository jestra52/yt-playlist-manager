namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>The details of a playlist item.</summary>
public sealed record PlaylistItemSnippet(
    string? Title,
    string? VideoOwnerChannelTitle,
    ResourceId? ResourceId,
    IReadOnlyDictionary<string, ThumbnailInfo>? Thumbnails);
