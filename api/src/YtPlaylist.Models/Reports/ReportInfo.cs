namespace YtPlaylist.Models.Reports;

/// <summary>A backup in a list, without its content.</summary>
public sealed record ReportInfo(
    string Id, string PlaylistId, string PlaylistName, string Reason, int VideoCount, long CreatedAt);
