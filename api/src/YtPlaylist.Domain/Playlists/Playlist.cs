namespace YtPlaylist.Domain.Playlists;

/// <summary>A named, ordered collection of videos, as stored in the cloud database.</summary>
public sealed class Playlist
{
    public required string Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public double Position { get; set; }

    /// <summary>Milliseconds since the Unix epoch, set by the device that created the row.</summary>
    public long CreatedAt { get; set; }

    /// <summary>Milliseconds since the Unix epoch; the newest edit wins.</summary>
    public long UpdatedAt { get; set; }

    /// <summary>Tombstone, so deletions reach other devices.</summary>
    public bool Deleted { get; set; }

    /// <summary>Server change number; clients pull rows with a higher value than their cursor.</summary>
    public long Seq { get; set; }
}
