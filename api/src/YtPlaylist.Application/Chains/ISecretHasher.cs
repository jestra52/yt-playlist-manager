namespace YtPlaylist.Application.Chains;

/// <summary>Creates the random secrets of sync chains and devices, and the hashes stored instead of them.</summary>
public interface ISecretHasher
{
    /// <summary>False when the server has no pepper (SYNC_PEPPER); sync chains are unavailable then.</summary>
    public bool IsConfigured { get; }

    /// <summary>A new secret: 32 bytes from a cryptographically secure generator, as base64url.</summary>
    public string NewSecret();

    /// <summary>
    /// HMAC-SHA256 of <paramref name="secret"/>, keyed with the server's pepper, as base64url.
    /// The same secret always gives the same hash, so it can be looked up.
    /// </summary>
    public string Hash(string secret);
}
