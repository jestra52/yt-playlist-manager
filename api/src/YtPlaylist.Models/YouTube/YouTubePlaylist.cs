namespace YtPlaylist.Models.YouTube;

/// <summary>A public YouTube playlist and the videos the app imports.</summary>
/// <param name="Id"></param>
/// <param name="Title"></param>
/// <param name="Author"></param>
/// <param name="Videos"></param>
/// <param name="Skipped">
/// Items left out: deleted or private videos (unless they were asked for, then they're in
/// <paramref name="Videos"/> with <see cref="VideoMetadata.Unavailable"/> set), and items without a video ID.
/// </param>
/// <param name="Partial">True when only part of the playlist could be read.</param>
/// <param name="Source">"api" (YouTube Data API) or "feed" (public feed).</param>
public sealed record YouTubePlaylist(
    string Id,
    string Title,
    string Author,
    IReadOnlyList<VideoMetadata> Videos,
    int Skipped,
    bool Partial,
    string Source);
