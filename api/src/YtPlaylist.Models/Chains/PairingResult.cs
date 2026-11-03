namespace YtPlaylist.Models.Chains;

/// <summary>
/// Body of POST /api/pairing/status: whether the request was approved. Once it is, the
/// first answer carries the new device's chain and credential; there's no second one.
/// </summary>
/// <param name="Status">Requested (still waiting), approved, denied or expired; see <see cref="PairingStatus"/>.</param>
/// <param name="ChainId">Set when approved.</param>
/// <param name="DeviceId">Set when approved.</param>
/// <param name="DeviceCredential">The new device's own secret, set when approved; only its HMAC is stored.</param>
public sealed record PairingResult(
    string Status, string? ChainId = null, string? DeviceId = null, string? DeviceCredential = null);
