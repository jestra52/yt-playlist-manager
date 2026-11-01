namespace YtPlaylist.Application.YouTube;

/// <summary>Mixes and personal lists such as Watch Later. Answered with 404.</summary>
public sealed class PlaylistNotSupportedException()
    : Exception("mixes and personal lists such as Watch Later can't be imported");
