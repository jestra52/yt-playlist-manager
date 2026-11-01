namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>A playlist in a <c>playlists.list</c> response.</summary>
internal sealed record PlaylistResource(PlaylistSnippet? Snippet);
