namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>A video in a <c>playlistItems.list</c> response.</summary>
internal sealed record PlaylistItemResource(PlaylistItemSnippet? Snippet);
