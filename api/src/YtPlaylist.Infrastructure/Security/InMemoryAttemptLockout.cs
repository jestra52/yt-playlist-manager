using System.Collections.Concurrent;
using YtPlaylist.Application.Chains;

namespace YtPlaylist.Infrastructure.Security;

/// <summary>
/// Failed attempts per key, in this process's memory: <see cref="MaxFailures"/> within
/// <see cref="Window"/> lock the key out for <see cref="LockDuration"/>. Restarting the API
/// clears it, which is acceptable for a lockout on top of codes that can't be guessed anyway.
/// </summary>
/// <param name="time">The clock.</param>
public sealed class InMemoryAttemptLockout(TimeProvider time) : IAttemptLockout
{
    public const int MaxFailures = 5;

    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    public static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(15);

    /// <summary>Above this many keys, entries that no longer matter are dropped.</summary>
    private const int PruneAbove = 10_000;

    private readonly ConcurrentDictionary<string, Entry> entries = new(StringComparer.Ordinal);

    public long? LockedUntil(string key)
    {
        if (!this.entries.TryGetValue(key, out var entry))
        {
            return null;
        }
        lock (entry)
        {
            return entry.LockedUntil > this.Now() ? entry.LockedUntil : null;
        }
    }

    public void RecordFailure(string key)
    {
        var now = this.Now();
        if (this.entries.Count > PruneAbove)
        {
            this.Prune(now);
        }
        var entry = this.entries.GetOrAdd(key, _ => new Entry());
        lock (entry)
        {
            if (now - entry.WindowStart >= (long)Window.TotalMilliseconds)
            {
                entry.WindowStart = now;
                entry.Failures = 0;
            }
            entry.Failures++;
            if (entry.Failures >= MaxFailures)
            {
                entry.LockedUntil = now + (long)LockDuration.TotalMilliseconds;
                entry.Failures = 0;
                entry.WindowStart = now;
            }
        }
    }

    private void Prune(long now)
    {
        foreach (var (key, entry) in this.entries)
        {
            bool stale;
            lock (entry)
            {
                stale = entry.LockedUntil <= now && now - entry.WindowStart >= (long)Window.TotalMilliseconds;
            }
            if (stale)
            {
                this.entries.TryRemove(key, out _);
            }
        }
    }

    private long Now() => time.GetUtcNow().ToUnixTimeMilliseconds();

    private sealed class Entry
    {
        public long WindowStart { get; set; }
        public int Failures { get; set; }
        public long LockedUntil { get; set; }
    }
}
