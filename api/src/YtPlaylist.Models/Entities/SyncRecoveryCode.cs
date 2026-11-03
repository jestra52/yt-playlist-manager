namespace YtPlaylist.Models.Entities;

/// <summary>
/// One of a chain's single-use recovery codes. Only a peppered HMAC of the code is
/// stored. Recovering with one replaces them all, so a chain has a full set or none.
/// </summary>
public sealed class SyncRecoveryCode
{
    public required string Id { get; set; }
    public required string ChainId { get; set; }

    /// <summary>HMAC-SHA256 of the code's canonical form, keyed with the server's pepper.</summary>
    public required string CodeHash { get; set; }

    /// <summary>Milliseconds since the Unix epoch.</summary>
    public long CreatedAt { get; set; }
}
