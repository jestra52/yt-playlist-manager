namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chain/pairing: the new pairing code, shown once on the creating device.</summary>
/// <param name="Code">The code as it's shown, like <c>7K3Q-D9X2</c>.</param>
/// <param name="ExpiresAt">Milliseconds since the Unix epoch.</param>
public sealed record PairingCodeInfo(string Code, long ExpiresAt);
