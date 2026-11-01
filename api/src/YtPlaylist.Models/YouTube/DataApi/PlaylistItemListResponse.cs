namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>YouTube Data API <c>playlistItems.list</c> response (one page).</summary>
public sealed record PlaylistItemListResponse(string? NextPageToken, IReadOnlyList<PlaylistItemResource>? Items);
