namespace YtPlaylist.Models.Chains;

/// <summary>
/// What a device gets when it creates, joins, claims or recovers a sync chain: its own
/// credential for every later request, and, when the chain is new, claimed or recovered,
/// the chain code's secret and the recovery codes, which are shown to the person once
/// and never stored.
/// </summary>
/// <param name="ChainId"></param>
/// <param name="DeviceId"></param>
/// <param name="DeviceCredential">The device's own secret, sent as a bearer token; only its HMAC is stored.</param>
/// <param name="Secret">The chain code's secret (base64url, 32 bytes) for a new, claimed or recovered chain; null when joining.</param>
/// <param name="RecoveryCodes">The chain's new single-use recovery codes, with the secret; null when joining.</param>
public sealed record ChainAccess(
    string ChainId, string DeviceId, string DeviceCredential, string? Secret, IReadOnlyList<string>? RecoveryCodes);
