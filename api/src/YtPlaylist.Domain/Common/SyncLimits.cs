namespace YtPlaylist.Domain.Common;

/// <summary>Size limits shared by validation, the database schema and the API.</summary>
public static class SyncLimits
{
    public const int MaxRowsPerSync = 2000;
    public const int MaxPullPageSize = 1000;
    public const int MaxIdLength = 64;
    public const int MaxNameLength = 200;
    public const int MaxTitleLength = 400;
    public const int MaxTextLength = 5000;
    public const int MaxUrlLength = 2048;
}
