namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>The title and channel of a playlist.</summary>
internal sealed record PlaylistSnippet(string? Title, string? ChannelTitle);
