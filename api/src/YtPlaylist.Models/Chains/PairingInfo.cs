namespace YtPlaylist.Models.Chains;

/// <summary>Body of GET /api/chain/pairing: where the calling device's pairing code stands.</summary>
/// <param name="Status">One of <see cref="PairingStatus"/>.</param>
/// <param name="RequesterName">The name of the device that entered the code; empty while waiting.</param>
/// <param name="ExpiresAt">Milliseconds since the Unix epoch.</param>
public sealed record PairingInfo(string Status, string RequesterName, long ExpiresAt);
