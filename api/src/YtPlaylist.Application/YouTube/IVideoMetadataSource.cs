namespace YtPlaylist.Application.YouTube;

/// <summary>Reads video titles and channels.</summary>
public interface IVideoMetadataSource
{
    /// <exception cref="YouTubeNotFoundException">For private, deleted or unknown videos.</exception>
    public Task<VideoMetadata> GetVideoAsync(string youTubeId, CancellationToken cancellationToken);
}
