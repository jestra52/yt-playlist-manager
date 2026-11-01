using YtPlaylist.Application.Sync;
using YtPlaylist.Models.Sync;

namespace YtPlaylist.Tests;

internal sealed class FakeSyncStore : ISyncStore
{
    public List<ChangeSet> Applied { get; } = [];
    public long? LastSince { get; private set; }
    public bool Fail { get; init; }

    public Task<int> ApplyAsync(ChangeSet changes, CancellationToken cancellationToken)
    {
        if (this.Fail)
        {
            throw new InvalidOperationException("boom");
        }
        this.Applied.Add(changes);
        return Task.FromResult(changes.Count);
    }

    public Task<ChangePage> GetChangesAsync(long since, int limit, CancellationToken cancellationToken)
    {
        this.LastSince = since;
        var remote = new PlaylistChange { Id = "p1", Name = "Remote", CreatedAt = 1, UpdatedAt = 2 };
        return Task.FromResult(new ChangePage(new ChangeSet { Playlists = [remote] }, 42, false));
    }
}
