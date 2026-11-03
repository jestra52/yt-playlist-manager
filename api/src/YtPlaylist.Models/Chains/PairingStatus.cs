namespace YtPlaylist.Models.Chains;

/// <summary>Where a pairing stands, as stored and as sent to both devices.</summary>
public static class PairingStatus
{
    /// <summary>The code was created and no device has entered it yet.</summary>
    public const string Waiting = "waiting";

    /// <summary>A device entered the code and waits for the creating device to decide.</summary>
    public const string Requested = "requested";

    /// <summary>The creating device allowed it; the new device can collect its credential.</summary>
    public const string Approved = "approved";

    public const string Denied = "denied";

    /// <summary>The new device collected its credential and is in the chain.</summary>
    public const string Joined = "joined";

    /// <summary>Only sent, never stored: the pairing's time ran out, or it was cancelled.</summary>
    public const string Expired = "expired";
}
