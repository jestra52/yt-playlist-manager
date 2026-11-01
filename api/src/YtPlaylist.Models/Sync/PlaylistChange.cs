namespace YtPlaylist.Models.Sync;

public sealed record PlaylistChange
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public double Position { get; init; }
    public long CreatedAt { get; init; }
    public long UpdatedAt { get; init; }
    public bool Deleted { get; init; }
}
