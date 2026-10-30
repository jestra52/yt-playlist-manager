using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;

namespace YtPlaylist.Domain.Common;

/// <summary>Shape checks for the IDs YouTube uses in links.</summary>
public static partial class YouTubeIds
{
    /// <summary>True for an 11-character video ID, such as dQw4w9WgXcQ.</summary>
    public static bool IsVideoId([NotNullWhen(true)] string? value) => value is not null && VideoId().IsMatch(value);

    /// <summary>True for a playlist ID, such as PL… or OLAK5uy_….</summary>
    public static bool IsPlaylistId([NotNullWhen(true)] string? value) => value is not null && PlaylistId().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9_-]{11}$")]
    private static partial Regex VideoId();

    [GeneratedRegex("^[A-Za-z0-9_-]{10,64}$")]
    private static partial Regex PlaylistId();
}
