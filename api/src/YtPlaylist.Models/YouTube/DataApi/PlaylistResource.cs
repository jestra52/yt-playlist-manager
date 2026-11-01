namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>A playlist in a <c>playlists.list</c> response.</summary>
public sealed record PlaylistResource(PlaylistSnippet? Snippet);
