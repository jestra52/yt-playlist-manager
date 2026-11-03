namespace YtPlaylist.Domain.Common;

/// <summary>What a YouTube <c>list</c> ID points to; see <see cref="YouTubeIds.ListKind"/>.</summary>
public enum YouTubeListKind
{
    /// <summary>A real playlist (PL…, an album, a channel's uploads, a curated YouTube Music playlist).</summary>
    Playlist,

    /// <summary>An auto-generated Mix: endless, personal to the viewer, and not readable as a playlist.</summary>
    Mix,

    /// <summary>A list only the viewer's own account can see, such as Watch later.</summary>
    Private,
}
