using System.Text;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// Codes people type, in Crockford's base32: read case-insensitively, without dashes or
/// spaces, and with O read as 0 and I or L as 1, so the canonical form is what's hashed.
/// Shared by recovery codes and pairing codes.
/// </summary>
public static class Base32Code
{
    /// <summary>Crockford's base32 alphabet: digits and letters without I, L, O and U.</summary>
    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    /// <summary>The canonical form of a typed code of <paramref name="length"/> characters, or null when it can't be one.</summary>
    public static string? Normalize(string? typed, int length)
    {
        if (typed is null || typed.Length > length * 2)
        {
            return null;
        }
        var canonical = new StringBuilder(length);
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
        return canonical.Length == length ? canonical.ToString() : null;
    }

    /// <summary>A canonical code in groups of <paramref name="groupLength"/> joined by dashes, as it's shown.</summary>
    public static string Format(string canonical, int groupLength)
    {
        ArgumentNullException.ThrowIfNull(canonical);
        return string.Join('-', Enumerable.Range(0, canonical.Length / groupLength)
            .Select(i => canonical.Substring(i * groupLength, groupLength)));
    }
}
