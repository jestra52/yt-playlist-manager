namespace YtPlaylist.Models.Entities;

/// <summary>
/// A short-lived pairing code, created by a device in a chain so that a new device can join
/// without the chain code, once the creating device approves it. Only peppered HMACs of the
/// code and of the new device's request token are stored. The new device's credential is
/// created when it collects it, so it's never stored either.
/// </summary>
public sealed class SyncPairing
{
    public required string Id { get; set; }
    public required string ChainId { get; set; }

    /// <summary>The device that created the code; only it can approve or deny the request.</summary>
    public required string CreatedByDeviceId { get; set; }

    /// <summary>HMAC-SHA256 of the code's canonical form, keyed with the server's pepper.</summary>
    public required string CodeHash { get; set; }

    /// <summary>One of <see cref="Chains.PairingStatus"/>: waiting, requested, approved, denied or joined.</summary>
    public required string Status { get; set; }

    /// <summary>Milliseconds since the Unix epoch.</summary>
    public long CreatedAt { get; set; }

    /// <summary>Milliseconds since the Unix epoch; nothing can be done with the pairing after it.</summary>
    public long ExpiresAt { get; set; }

    /// <summary>The name of the device that entered the code; empty until one does.</summary>
    public string RequesterName { get; set; } = "";

    /// <summary>HMAC-SHA256 of the token the new device asks for its credential with; null until it enters the code.</summary>
    public string? RequestTokenHash { get; set; }
}
