using YtPlaylist.Models.YouTube;

namespace YtPlaylist.Application.YouTube;

/// <summary>Reads public YouTube playlists.</summary>
public interface IYouTubePlaylistSource
{
    /// <param name="playlistId"></param>
    /// <param name="includeUnavailable">
    /// Also return deleted and private videos YouTube still lists, flagged as unavailable.
    /// Only the YouTube Data API reports them; the public feed leaves them out.
    /// </param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="YouTubeNotFoundException">For private or unknown playlists.</exception>
    /// <exception cref="PlaylistNotSupportedException">For mixes and personal lists.</exception>
    public Task<YouTubePlaylist> GetPlaylistAsync(
        string playlistId, bool includeUnavailable, CancellationToken cancellationToken);
}
