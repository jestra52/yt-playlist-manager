namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>The details of a playlist item.</summary>
internal sealed record PlaylistItemSnippet(
    string? Title,
    string? VideoOwnerChannelTitle,
    ResourceId? ResourceId,
    IReadOnlyDictionary<string, ThumbnailInfo>? Thumbnails);
