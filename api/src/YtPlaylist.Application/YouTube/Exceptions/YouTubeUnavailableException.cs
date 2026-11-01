namespace YtPlaylist.Application.YouTube;

/// <summary>YouTube answered with an unexpected error. Answered with 502.</summary>
public sealed class YouTubeUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
