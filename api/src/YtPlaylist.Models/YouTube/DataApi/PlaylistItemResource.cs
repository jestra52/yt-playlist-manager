namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>A video in a <c>playlistItems.list</c> response.</summary>
public sealed record PlaylistItemResource(PlaylistItemSnippet? Snippet);
