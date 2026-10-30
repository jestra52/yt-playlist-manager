namespace YtPlaylist.Domain.Videos;

/// <summary>A YouTube video saved into a playlist, as stored in the cloud database.</summary>
public sealed class Video
{
    public required string Id { get; set; }
    public required string PlaylistId { get; set; }
    public required string YouTubeId { get; set; }
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public string ThumbnailUrl { get; set; } = "";
    public string Notes { get; set; } = "";
    public bool Watched { get; set; }
    public double Position { get; set; }
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }
    public bool Deleted { get; set; }
    public long Seq { get; set; }
}
