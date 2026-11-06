using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;
using YtPlaylist.Models.Reports;

namespace YtPlaylist.Application.Reports;

/// <summary>Keeps playlist backups in a device's sync chain.</summary>
/// <param name="timeProvider"></param>
/// <param name="store">Null when no database is configured; backups are unavailable then.</param>
public sealed class ReportService(TimeProvider timeProvider, IReportStore? store = null)
{
    public bool IsAvailable => store is not null;

    private IReportStore RequireStore() => store ?? throw new InvalidOperationException("No database is configured.");

    /// <exception cref="DomainValidationException">When the backup is invalid.</exception>
    public Task<bool> SaveAsync(DeviceContext caller, SaveReportRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        ArgumentNullException.ThrowIfNull(request);
        Validate(request);
        var deletedBefore = timeProvider.GetUtcNow()
            .AddDays(-SyncLimits.DeletedPlaylistReportDays)
            .ToUnixTimeMilliseconds();
        var report = new Report
        {
            Id = request.Id,
            ChainId = caller.ChainId,
            PlaylistId = request.PlaylistId,
            PlaylistName = request.PlaylistName,
            Reason = request.Reason,
            VideoCount = request.VideoCount,
            Content = request.Content,
            CreatedAt = request.CreatedAt,
        };
        return this.RequireStore().SaveAsync(report, deletedBefore, cancellationToken);
    }

    public Task<IReadOnlyList<ReportInfo>> ListAsync(
        DeviceContext caller, string? playlistId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        return this.RequireStore().ListAsync(caller.ChainId, playlistId, cancellationToken);
    }

    public Task<Report?> FindAsync(DeviceContext caller, string id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);
        return this.RequireStore().FindAsync(caller.ChainId, id, cancellationToken);
    }

    private static void Validate(SaveReportRequest request)
    {
        ChangeSetValidator.RequireId("report id", request.Id);
        ChangeSetValidator.RequireId("playlistId", request.PlaylistId);
        if (request.PlaylistName.Length > SyncLimits.MaxNameLength)
        {
            throw new DomainValidationException("playlistName is too long");
        }
        if (request.Reason.Length is 0 or > SyncLimits.MaxReasonLength)
        {
            throw new DomainValidationException("reason is required, and must be short");
        }
        if (request.Content.Length is 0 or > SyncLimits.MaxReportLength)
        {
            throw new DomainValidationException("content is required, and must be under the size limit");
        }
        if (request.VideoCount < 0 || request.CreatedAt <= 0)
        {
            throw new DomainValidationException("videoCount and createdAt must be valid");
        }
    }
}
