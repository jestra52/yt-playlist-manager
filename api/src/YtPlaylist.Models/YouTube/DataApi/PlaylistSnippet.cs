namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>The title and channel of a playlist.</summary>
public sealed record PlaylistSnippet(string? Title, string? ChannelTitle);
