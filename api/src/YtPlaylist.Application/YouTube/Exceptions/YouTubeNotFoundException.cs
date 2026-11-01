namespace YtPlaylist.Application.YouTube;

/// <summary>The video or playlist doesn't exist, is private, or can't be embedded. Answered with 404.</summary>
public sealed class YouTubeNotFoundException(string message) : Exception(message);
