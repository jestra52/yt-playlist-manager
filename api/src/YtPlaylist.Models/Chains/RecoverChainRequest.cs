namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chains/recover.</summary>
public sealed record RecoverChainRequest
{
    /// <summary>One of the chain's recovery codes, as typed (dashes, spaces and case don't matter).</summary>
    public string RecoveryCode { get; init; } = "";

    public string DeviceName { get; init; } = "";
}
