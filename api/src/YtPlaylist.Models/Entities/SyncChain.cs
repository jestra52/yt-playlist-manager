namespace YtPlaylist.Models.Entities;

/// <summary>
/// One library, shared by the devices that joined it with its code. The code's
/// secret is never stored: only a peppered HMAC of it, to find the chain when a
/// device joins.
/// </summary>
public sealed class SyncChain
{
    /// <summary>
    /// The chain that holds the data synced with the single shared SYNC_TOKEN from
    /// before sync chains. It has no secret until a device claims it with that token.
    /// </summary>
    public const string LegacyId = "legacy";

    public required string Id { get; set; }

    /// <summary>HMAC-SHA256 of the chain code's secret, keyed with the server's pepper; null for an unclaimed legacy chain.</summary>
    public string? SecretHash { get; set; }

    /// <summary>Milliseconds since the Unix epoch.</summary>
    public long CreatedAt { get; set; }

    /// <summary>
    /// Milliseconds since the Unix epoch until which no pairing code can be created, after
    /// repeated refused attempts to join with one; null when pairing isn't paused.
    /// </summary>
    public long? PairingLockedUntil { get; set; }
}
