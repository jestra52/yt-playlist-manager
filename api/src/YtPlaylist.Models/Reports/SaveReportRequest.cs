namespace YtPlaylist.Models.Reports;

public sealed record SaveReportRequest
{
    public string Id { get; init; } = "";
    public string PlaylistId { get; init; } = "";
    public string PlaylistName { get; init; } = "";
    public string Reason { get; init; } = "";
    public int VideoCount { get; init; }
    public long CreatedAt { get; init; }

    /// <summary>The JSON report, as text.</summary>
    public string Content { get; init; } = "";
}
