namespace YtPlaylist.Domain.Common;

/// <summary>
/// Single-row table holding the last change number handed out. Locking this row
/// serializes sync writes, so change numbers are committed in order.
/// </summary>
public sealed class SyncCounter
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;
    public long Value { get; set; }
}
