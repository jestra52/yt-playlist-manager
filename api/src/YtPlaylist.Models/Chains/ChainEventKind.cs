namespace YtPlaylist.Models.Chains;

/// <summary>The kinds of entries in a chain's audit log.</summary>
public static class ChainEventKind
{
    public const string Created = "created";
    public const string Claimed = "claimed";
    public const string DeviceJoined = "device_joined";
    public const string DeviceRemoved = "device_removed";
    public const string DeviceLeft = "device_left";
    public const string CodeReplaced = "code_replaced";
    public const string Recovered = "recovered";
    public const string RecoveryCodesRenewed = "recovery_codes_renewed";
    public const string PairingStarted = "pairing_started";
    public const string PairingApproved = "pairing_approved";
    public const string PairingDenied = "pairing_denied";

    /// <summary>A pairing code that a device had already entered was entered again.</summary>
    public const string PairingBlocked = "pairing_blocked";

    /// <summary>Adding devices with a pairing code was paused after repeated refused attempts.</summary>
    public const string PairingLocked = "pairing_locked";
}
