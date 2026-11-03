using System.Text;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// Recovery codes: 20 characters of Crockford base32 (100 random bits), shown in groups of
/// five, like <c>7K3QD-M9X2A-…</c>. Typed codes are read case-insensitively, without dashes
/// or spaces, and with O read as 0 and I or L as 1, so the canonical form is what's hashed.
/// </summary>
public static class RecoveryCode
{
    /// <summary>Crockford's base32 alphabet: digits and letters without I, L, O and U.</summary>
    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public const int Length = 20;

    /// <summary>How many codes a chain gets at a time.</summary>
    public const int SetSize = 10;

    private const int GroupLength = 5;

    /// <summary>The canonical form of a typed code (upper case, no separators), or null when it can't be one.</summary>
    public static string? Normalize(string? typed)
    {
        if (typed is null || typed.Length > Length * 2)
        {
            return null;
        }
        var canonical = new StringBuilder(Length);
        foreach (var c in typed)
        {
            if (c is '-' || char.IsWhiteSpace(c))
            {
                continue;
            }
            var upper = char.ToUpperInvariant(c) switch
            {
                'O' => '0',
                'I' or 'L' => '1',
                var other => other,
            };
            if (!Alphabet.Contains(upper, StringComparison.Ordinal))
            {
                return null;
            }
            canonical.Append(upper);
        }
        return canonical.Length == Length ? canonical.ToString() : null;
    }

    /// <summary>A canonical code in groups of five joined by dashes, as it's shown.</summary>
    public static string Format(string canonical)
    {
        ArgumentNullException.ThrowIfNull(canonical);
        return string.Join('-', Enumerable.Range(0, canonical.Length / GroupLength)
            .Select(i => canonical.Substring(i * GroupLength, GroupLength)));
    }
}
