using YtPlaylist.Models.YouTube;

namespace YtPlaylist.Application.YouTube;

/// <summary>Reads public YouTube playlists.</summary>
public interface IYouTubePlaylistSource
{
    /// <exception cref="YouTubeNotFoundException">For private or unknown playlists.</exception>
    /// <exception cref="PlaylistNotSupportedException">For mixes and personal lists.</exception>
    public Task<YouTubePlaylist> GetPlaylistAsync(string playlistId, CancellationToken cancellationToken);
}
