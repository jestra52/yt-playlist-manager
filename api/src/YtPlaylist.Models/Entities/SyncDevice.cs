namespace YtPlaylist.Models.Entities;

/// <summary>
/// A device in a sync chain. It syncs with its own credential, so it doesn't keep
/// the chain code, and it can be removed on its own. Only a peppered HMAC of the
/// credential is stored.
/// </summary>
public sealed class SyncDevice
{
    public required string Id { get; set; }
    public required string ChainId { get; set; }

    /// <summary>HMAC-SHA256 of the device credential, keyed with the server's pepper.</summary>
    public required string CredentialHash { get; set; }

    /// <summary>What the person sees in the device list, e.g. "Chrome on Windows".</summary>
    public string Name { get; set; } = "";

    /// <summary>Milliseconds since the Unix epoch.</summary>
    public long CreatedAt { get; set; }

    /// <summary>Milliseconds since the Unix epoch; updated at most every few minutes.</summary>
    public long LastSeenAt { get; set; }
}
