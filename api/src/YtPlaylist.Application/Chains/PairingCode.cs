namespace YtPlaylist.Application.Chains;

/// <summary>
/// Pairing codes: 8 characters of Crockford base32 (40 random bits), shown as <c>7K3Q-D9X2</c>
/// and read like every <see cref="Base32Code"/>. That's enough for a code that works once, for
/// a few minutes, behind per-IP lockouts, and only after the device that created it approves.
/// </summary>
public static class PairingCode
{
    public const int Length = 8;

    /// <summary>How long a new code can be entered.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    /// <summary>How long the creating device has to approve once a code was entered, and the new device to collect its credential.</summary>
    public static readonly TimeSpan ApprovalWindow = TimeSpan.FromMinutes(5);

    /// <summary>Refused attempts (denied requests, or a used code entered again) that pause pairing for a chain...</summary>
    public const int StrikeLimit = 3;

    /// <summary>...within this time...</summary>
    public static readonly TimeSpan StrikeWindow = TimeSpan.FromHours(1);

    /// <summary>...for this long.</summary>
    public static readonly TimeSpan LockDuration = TimeSpan.FromHours(1);

    private const int GroupLength = 4;

    /// <summary>The canonical form of a typed code (upper case, no separators), or null when it can't be one.</summary>
    public static string? Normalize(string? typed) => Base32Code.Normalize(typed, Length);

    /// <summary>A canonical code as two groups of four joined by a dash, as it's shown.</summary>
    public static string Format(string canonical) => Base32Code.Format(canonical, GroupLength);
}
