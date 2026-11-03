namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chain/recovery-codes: new recovery codes, shown once; the old ones stopped working.</summary>
/// <param name="Codes"></param>
public sealed record RecoveryCodes(IReadOnlyList<string> Codes);
