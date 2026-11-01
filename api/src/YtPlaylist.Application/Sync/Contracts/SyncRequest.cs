namespace YtPlaylist.Application.Sync;

/// <summary>What a device sends: its local changes and the last server change it has seen.</summary>
public sealed record SyncRequest
{
    public long Since { get; init; }
    public ChangeSet Changes { get; init; } = new();
}
