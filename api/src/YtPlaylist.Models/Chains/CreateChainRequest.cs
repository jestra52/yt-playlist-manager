namespace YtPlaylist.Models.Chains;

/// <summary>Body of POST /api/chains and POST /api/chains/claim.</summary>
public sealed record CreateChainRequest
{
    /// <summary>How this device shows in the device list, e.g. "Chrome on Windows".</summary>
    public string DeviceName { get; init; } = "";
}
