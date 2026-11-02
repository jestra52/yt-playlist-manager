using System.Text.Json.Serialization;

namespace YtPlaylist.Models.Sync;

public sealed record VideoChange
{
    public string Id { get; init; } = "";
    public string PlaylistId { get; init; } = "";
    [JsonPropertyName("youtubeId")]
    public string YouTubeId { get; init; } = "";
    public string Title { get; init; } = "";
    public string Author { get; init; } = "";
    /// <summary>Null when the device's app is older than artists; the stored artist is kept then.</summary>
    public string? Artist { get; init; }
    /// <summary>Null when the device's app is older than artists; see <see cref="Entities.Video.ArtistSource"/>.</summary>
    public string? ArtistSource { get; init; }
    public string ThumbnailUrl { get; init; } = "";
    public string Notes { get; init; } = "";
    public bool Watched { get; init; }
    /// <summary>Null when the device's app is older than this flag; the stored value is kept then.</summary>
    public bool? Unavailable { get; init; }
    public double Position { get; init; }
    public long CreatedAt { get; init; }
    public long UpdatedAt { get; init; }
    public bool Deleted { get; init; }
}
