namespace YtPlaylist.Application.Chains;

/// <summary>
/// Recovery codes: 20 characters of Crockford base32 (100 random bits), shown in groups of
/// five, like <c>7K3QD-M9X2A-…</c>, and read like every <see cref="Base32Code"/>.
/// </summary>
public static class RecoveryCode
{
    /// <summary>Crockford's base32 alphabet: digits and letters without I, L, O and U.</summary>
    public const string Alphabet = Base32Code.Alphabet;

    public const int Length = 20;

    /// <summary>How many codes a chain gets at a time.</summary>
    public const int SetSize = 10;

    private const int GroupLength = 5;

    /// <summary>The canonical form of a typed code (upper case, no separators), or null when it can't be one.</summary>
    public static string? Normalize(string? typed) => Base32Code.Normalize(typed, Length);

    /// <summary>A canonical code in groups of five joined by dashes, as it's shown.</summary>
    public static string Format(string canonical) => Base32Code.Format(canonical, GroupLength);
}
