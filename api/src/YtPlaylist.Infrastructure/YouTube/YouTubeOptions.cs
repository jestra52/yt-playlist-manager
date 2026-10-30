namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>YouTube endpoints and the optional Data API key (YOUTUBE_API_KEY).</summary>
public sealed class YouTubeOptions
{
    /// <summary>Optional. With a key, playlist imports read whole playlists.</summary>
    public string ApiKey { get; set; } = "";

    public Uri OEmbedEndpoint { get; set; } = new("https://www.youtube.com/oembed");
    public Uri DataApiBase { get; set; } = new("https://www.googleapis.com/youtube/v3/");
    public Uri FeedEndpoint { get; set; } = new("https://www.youtube.com/feeds/videos.xml");

    /// <summary>Most videos one playlist import reads.</summary>
    public int MaxPlaylistVideos { get; set; } = 1000;

    /// <summary>Longest one playlist import may take; under Netlify's 26-second proxy limit.</summary>
    public TimeSpan PlaylistTimeout { get; set; } = TimeSpan.FromSeconds(20);
}
