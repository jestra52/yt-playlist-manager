namespace YtPlaylist.Application.Sync;

/// <summary>Server changes newer than the device's cursor.</summary>
public sealed record SyncResponse(long Cursor, bool HasMore, int Applied, ChangeSet Changes);
