namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chain/replace: the new chain code's secret and recovery codes, shown once.</summary>
/// <param name="Secret"></param>
/// <param name="RecoveryCodes">The new recovery codes; the old ones stopped working.</param>
public sealed record ChainSecret(string Secret, IReadOnlyList<string> RecoveryCodes);
