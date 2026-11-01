namespace YtPlaylist.Application.Sync;

/// <summary>A page of server changes, oldest first.</summary>
public sealed record ChangePage(ChangeSet Changes, long Cursor, bool HasMore);

