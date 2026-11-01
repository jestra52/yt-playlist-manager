namespace YtPlaylist.Application.YouTube;

/// <summary>A public YouTube playlist and the videos the app imports.</summary>
/// <param name="Id"></param>
/// <param name="Title"></param>
/// <param name="Author"></param>
/// <param name="Videos"></param>
/// <param name="Skipped">Deleted or private videos left out.</param>
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
