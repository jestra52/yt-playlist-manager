using YtPlaylist.Models.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// A refused attempt to join a chain with a pairing code (a denied request, or a used code
/// entered again), stored with its audit entry. When the chain has <see cref="Limit"/> of them
/// since <see cref="Since"/>, pairing is paused until <see cref="LockedUntil"/>: its open
/// pairings are cancelled and <see cref="LockEvent"/> is logged, in the same transaction.
/// </summary>
/// <param name="ChainId"></param>
/// <param name="Event">The strike's audit entry (pairing_denied or pairing_blocked).</param>
/// <param name="Since">Milliseconds since the Unix epoch: older strikes, and those before the last lock ended, don't count.</param>
/// <param name="Limit">How many strikes, this one included, pause pairing.</param>
/// <param name="LockedUntil">Milliseconds since the Unix epoch.</param>
/// <param name="LockEvent">The pairing_locked audit entry.</param>
public sealed record PairingStrike(
    string ChainId, SyncChainEvent Event, long Since, int Limit, long LockedUntil, SyncChainEvent LockEvent)
{
    /// <summary>The audit log kinds that count as strikes.</summary>
    public static readonly IReadOnlyList<string> Kinds = [ChainEventKind.PairingDenied, ChainEventKind.PairingBlocked];
}
