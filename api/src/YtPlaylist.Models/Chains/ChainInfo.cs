namespace YtPlaylist.Models.Chains;

/// <summary>Body of GET /api/chain: the caller's chain and its devices.</summary>
/// <param name="ChainId"></param>
/// <param name="DeviceId">The device making the request.</param>
/// <param name="Devices">Every device in the chain, oldest first.</param>
/// <param name="RecoveryCodesLeft">How many unused recovery codes the chain has (a full set or none).</param>
public sealed record ChainInfo(string ChainId, string DeviceId, IReadOnlyList<DeviceInfo> Devices, int RecoveryCodesLeft);
