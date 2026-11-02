namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chain/replace: the new chain code's secret, shown once.</summary>
public sealed record ChainSecret(string Secret);
