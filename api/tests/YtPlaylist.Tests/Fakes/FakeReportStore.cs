using YtPlaylist.Application.Reports;
using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Reports;

namespace YtPlaylist.Tests;

internal sealed class FakeReportStore : IReportStore
{
    private readonly List<Report> reports = [];

    public Task<bool> SaveAsync(Report report, long deletedBefore, CancellationToken cancellationToken)
    {
        if (this.reports.Any(r => r.ChainId == report.ChainId && r.Id == report.Id))
        {
            return Task.FromResult(false);
        }
        this.reports.Add(report);
        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<ReportInfo>> ListAsync(string chainId, string? playlistId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ReportInfo>>(
            [.. this.reports
                .Where(r => r.ChainId == chainId && (playlistId is null || r.PlaylistId == playlistId))
                .Select(r => new ReportInfo(r.Id, r.PlaylistId, r.PlaylistName, r.Reason, r.VideoCount, r.CreatedAt))]);

    public Task<Report?> FindAsync(string chainId, string id, CancellationToken cancellationToken) =>
        Task.FromResult(this.reports.FirstOrDefault(r => r.ChainId == chainId && r.Id == id));
}
