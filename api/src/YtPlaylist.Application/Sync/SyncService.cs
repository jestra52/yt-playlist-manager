using YtPlaylist.Domain.Common;

namespace YtPlaylist.Application.Sync;

/// <summary>
/// The two-way sync use case: store the device's changes, then return every
/// server change newer than the device's cursor.
/// </summary>
/// <param name="store">Null when no database is configured; sync is then unavailable.</param>
public sealed class SyncService(ISyncStore? store = null)
{
    public bool IsAvailable => store is not null;

    /// <exception cref="DomainValidationException">When the request is invalid.</exception>
    /// <exception cref="InvalidOperationException">When no database is configured.</exception>
    public async Task<SyncResponse> SyncAsync(SyncRequest request, int? limit, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (store is null)
        {
            throw new InvalidOperationException("No database is configured.");
        }
        if (request.Since < 0)
        {
            throw new DomainValidationException("since must be >= 0");
        }
        ChangeSetValidator.Validate(request.Changes);

        var applied = request.Changes.Count == 0
            ? 0
            : await store.ApplyAsync(request.Changes, cancellationToken).ConfigureAwait(false);

        var pageSize = limit is > 0 and <= SyncLimits.MaxPullPageSize ? limit.Value : SyncLimits.MaxPullPageSize;
        var page = await store.GetChangesAsync(request.Since, pageSize, cancellationToken).ConfigureAwait(false);
        return new SyncResponse(page.Cursor, page.HasMore, applied, page.Changes);
    }
}
