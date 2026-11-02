namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chains/join.</summary>
public sealed record JoinChainRequest
{
    /// <summary>The chain code's secret (base64url), decoded from its words on the device.</summary>
    public string Secret { get; init; } = "";

    public string DeviceName { get; init; } = "";
}
