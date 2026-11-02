namespace YtPlaylist.Application.Chains;

/// <summary>The device a request was authenticated as, and the chain it belongs to.</summary>
public sealed record DeviceContext(string ChainId, string DeviceId);
