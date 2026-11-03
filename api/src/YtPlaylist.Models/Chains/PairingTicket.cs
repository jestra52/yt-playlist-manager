namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chains/pair: what the new device asks for its credential with.</summary>
/// <param name="RequestToken">A secret (base64url, 32 bytes) sent as a bearer token to POST /api/pairing/status; only its HMAC is stored.</param>
/// <param name="ExpiresAt">Milliseconds since the Unix epoch; the request has to be approved by then.</param>
public sealed record PairingTicket(string RequestToken, long ExpiresAt);
