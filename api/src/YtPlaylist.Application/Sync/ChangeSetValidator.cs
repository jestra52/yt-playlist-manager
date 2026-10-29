using System.Text.RegularExpressions;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Application.Sync;

/// <summary>Checks rows coming from a device before they are stored.</summary>
public static partial class ChangeSetValidator
{
    /// <exception cref="DomainValidationException">When a row breaks a rule.</exception>
    public static void Validate(ChangeSet changes)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (changes.Count > SyncLimits.MaxRowsPerSync)
        {
            throw new DomainValidationException(
                $"too many rows in one sync ({changes.Count} > {SyncLimits.MaxRowsPerSync})");
        }
        foreach (var playlist in changes.Playlists)
        {
            Validate(playlist);
        }
        foreach (var video in changes.Videos)
        {
            Validate(video);
        }
    }

    private static void Validate(PlaylistChange p)
    {
        RequireId("playlist id", p.Id);
        if (!p.Deleted && string.IsNullOrEmpty(p.Name))
        {
            throw new DomainValidationException($"playlist {p.Id} has no name");
        }
        MaxLength("playlist name", p.Name, SyncLimits.MaxNameLength);
        MaxLength("playlist description", p.Description, SyncLimits.MaxTextLength);
        RequireTimestamps("playlist", p.Id, p.CreatedAt, p.UpdatedAt);
    }

    private static void Validate(VideoChange v)
    {
        RequireId("video id", v.Id);
        RequireId("video playlistId", v.PlaylistId);
        if (!YouTubeIds.IsVideoId(v.YouTubeId))
        {
            throw new DomainValidationException($"video {v.Id} has an invalid youtubeId");
        }
        MaxLength("video title", v.Title, SyncLimits.MaxTitleLength);
        MaxLength("video author", v.Author, SyncLimits.MaxNameLength);
        MaxLength("video thumbnailUrl", v.ThumbnailUrl, SyncLimits.MaxUrlLength);
        MaxLength("video notes", v.Notes, SyncLimits.MaxTextLength);
        RequireTimestamps("video", v.Id, v.CreatedAt, v.UpdatedAt);
    }

    private static void RequireId(string field, string? id)
    {
        if (string.IsNullOrEmpty(id) || id.Length > SyncLimits.MaxIdLength || !RowId().IsMatch(id))
        {
            throw new DomainValidationException($"{field} \"{id}\" is not a valid id");
        }
    }

    private static void MaxLength(string field, string? value, int limit)
    {
        // Count characters as the browser does (UTF-16 code units would over-count emoji).
        if (value is not null && value.EnumerateRunes().Count() > limit)
        {
            throw new DomainValidationException($"{field} is longer than {limit} characters");
        }
    }

    private static void RequireTimestamps(string kind, string id, long createdAt, long updatedAt)
    {
        if (createdAt <= 0 || updatedAt <= 0)
        {
            throw new DomainValidationException($"{kind} {id} has no timestamps");
        }
    }

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex RowId();
}
