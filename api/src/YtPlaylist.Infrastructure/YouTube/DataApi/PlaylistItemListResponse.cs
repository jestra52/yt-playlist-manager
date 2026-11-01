namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>YouTube Data API <c>playlistItems.list</c> response (one page).</summary>
internal sealed record PlaylistItemListResponse(string? NextPageToken, IReadOnlyList<PlaylistItemResource>? Items);
