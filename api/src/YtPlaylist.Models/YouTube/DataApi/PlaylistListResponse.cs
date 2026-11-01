namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>YouTube Data API <c>playlists.list</c> response.</summary>
public sealed record PlaylistListResponse(IReadOnlyList<PlaylistResource>? Items);
