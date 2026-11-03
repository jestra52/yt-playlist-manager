namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chains/pair.</summary>
public sealed record PairDeviceRequest
{
    /// <summary>The pairing code, as typed (dashes, spaces and case don't matter).</summary>
    public string Code { get; init; } = "";

    public string DeviceName { get; init; } = "";
}
