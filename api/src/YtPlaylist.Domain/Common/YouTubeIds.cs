using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;

namespace YtPlaylist.Domain.Common;

/// <summary>Shape checks for the IDs YouTube uses in links.</summary>
public static partial class YouTubeIds
{
    private static readonly (string Value, bool Exact, YouTubeListKind Kind)[] ListRules =
    [
        ("WL", true, YouTubeListKind.Private),
        ("LL", true, YouTubeListKind.Private),
        ("LM", true, YouTubeListKind.Private),
        ("RDCLAK5uy_", false, YouTubeListKind.Playlist),
        ("RD", false, YouTubeListKind.Mix),
    ];

    /// <summary>True for an 11-character video ID, such as dQw4w9WgXcQ.</summary>
    public static bool IsVideoId([NotNullWhen(true)] string? value) => value is not null && VideoId().IsMatch(value);

    /// <summary>True for a playlist ID, such as PL… or OLAK5uy_….</summary>
    public static bool IsPlaylistId([NotNullWhen(true)] string? value) => value is not null && PlaylistId().IsMatch(value);

    public static YouTubeListKind ListKind(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        foreach (var (rule, exact, kind) in ListRules)
        {
            if (exact ? value == rule : value.StartsWith(rule, StringComparison.Ordinal))
            {
                return kind;
            }
        }

        return YouTubeListKind.Playlist;
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{11}$")]
    private static partial Regex VideoId();

    [GeneratedRegex("^[A-Za-z0-9_-]{10,64}$")]
    private static partial Regex PlaylistId();
}
