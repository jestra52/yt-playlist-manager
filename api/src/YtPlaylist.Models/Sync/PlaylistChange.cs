namespace YtPlaylist.Models.Sync;

public sealed record PlaylistChange
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public double Position { get; init; }
    /// <summary>Null when the device's app is older than imports were remembered; the stored source is kept then.</summary>
    public string? Source { get; init; }
    /// <summary>Null when the device's app is older than imports were remembered.</summary>
    public string? SourceId { get; init; }
    public long CreatedAt { get; init; }
    public long UpdatedAt { get; init; }
    public bool Deleted { get; init; }
}
