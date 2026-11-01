namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>YouTube Data API <c>playlists.list</c> response.</summary>
internal sealed record PlaylistListResponse(IReadOnlyList<PlaylistResource>? Items);
