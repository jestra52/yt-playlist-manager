using YtPlaylist.Application.YouTube;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Tests;

internal sealed class FakeYouTube : IVideoMetadataSource, IYouTubePlaylistSource
{
    public Task<VideoMetadata> GetVideoAsync(string youTubeId, CancellationToken cancellationToken) => youTubeId switch
    {
        "aaaaaaaaaaa" => throw new YouTubeNotFoundException("video not found or not embeddable"),
        _ when !YouTubeIds.IsVideoId(youTubeId) => throw new DomainValidationException("invalid youtube id"),
        _ => Task.FromResult(new VideoMetadata(youTubeId, $"Title {youTubeId}", "Channel", "")),
    };

    public Task<YouTubePlaylist> GetPlaylistAsync(string playlistId, CancellationToken cancellationToken) => playlistId switch
    {
        "PLprivateprivate" => throw new YouTubeNotFoundException("playlist not found, or it is private"),
        "PLbrokenbroken" => throw new YouTubeUnavailableException("upstream down"),
        "bad" => throw new DomainValidationException("invalid playlist id"),
        _ => Task.FromResult(new YouTubePlaylist(
            playlistId, "Road trip", "Juan", [new VideoMetadata("dQw4w9WgXcQ", "One", "A", "")], 0, false, "feed")),
    };
}
