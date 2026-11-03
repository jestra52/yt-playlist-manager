namespace YtPlaylist.Application.Chains;

/// <summary>The device a request was authenticated as, and the chain it belongs to.</summary>
/// <param name="ChainId"></param>
/// <param name="DeviceId"></param>
/// <param name="DeviceName">How the device is named, for the audit log.</param>
public sealed record DeviceContext(string ChainId, string DeviceId, string DeviceName = "");
