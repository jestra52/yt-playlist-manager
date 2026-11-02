namespace YtPlaylist.Models.Chains;

/// <summary>
/// What a device gets when it creates, joins or claims a sync chain: its own
/// credential for every later request, and, when the chain is new or claimed, the
/// chain code's secret, which is shown to the person once and never stored.
/// </summary>
/// <param name="ChainId"></param>
/// <param name="DeviceId"></param>
/// <param name="DeviceCredential">The device's own secret, sent as a bearer token; only its HMAC is stored.</param>
/// <param name="Secret">The chain code's secret (base64url, 32 bytes) for a new or claimed chain; null when joining.</param>
public sealed record ChainAccess(string ChainId, string DeviceId, string DeviceCredential, string? Secret);
