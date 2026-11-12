using System.Text.RegularExpressions;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Sync;

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
        RequireSource("playlist", p.Id, "source", p.Source);
        if (p.SourceId is { Length: > 0 } sourceId && (sourceId.Length > SyncLimits.MaxIdLength || !RowId().IsMatch(sourceId)))
        {
            throw new DomainValidationException($"playlist {p.Id} has an invalid sourceId");
        }
        RequireTimestamps("playlist", p.Id, p.CreatedAt, p.UpdatedAt);
    }

    private static void Validate(VideoChange v)
    {
        RequireId("video id", v.Id);
        RequireId("video playlistId", v.PlaylistId);
        if (v.YouTubeId.Length == 0)
        {
            if (!v.Deleted && string.IsNullOrWhiteSpace(v.Title))
            {
                throw new DomainValidationException($"video {v.Id} has neither a youtubeId nor a title");
            }
        }
        else if (!YouTubeIds.IsVideoId(v.YouTubeId))
        {
            throw new DomainValidationException($"video {v.Id} has an invalid youtubeId");
        }
        if (!string.IsNullOrEmpty(v.ReplacedYouTubeId) && !YouTubeIds.IsVideoId(v.ReplacedYouTubeId))
        {
            throw new DomainValidationException($"video {v.Id} has an invalid replacedYoutubeId");
        }
        MaxLength("video title", v.Title, SyncLimits.MaxTitleLength);
        MaxLength("video author", v.Author, SyncLimits.MaxNameLength);
        MaxLength("video artist", v.Artist, SyncLimits.MaxNameLength);
        RequireSource("video", v.Id, "artistSource", v.ArtistSource);
        ValidateArtists(v);
        MaxLength("video thumbnailUrl", v.ThumbnailUrl, SyncLimits.MaxUrlLength);
        MaxLength("video notes", v.Notes, SyncLimits.MaxTextLength);
        RequireTimestamps("video", v.Id, v.CreatedAt, v.UpdatedAt);
    }

    private static void ValidateArtists(VideoChange v)
    {
        if (v.Artists is not { } artists)
        {
            return;
        }
        if (artists.Count > SyncLimits.MaxArtistsPerVideo)
        {
            throw new DomainValidationException($"video {v.Id} has more than {SyncLimits.MaxArtistsPerVideo} artists");
        }
        foreach (var artist in artists)
        {
            if (artist is null || string.IsNullOrWhiteSpace(artist.Name) || artist.Role is not ("main" or "featured"))
            {
                throw new DomainValidationException($"video {v.Id} has an invalid artist");
            }
            MaxLength("video artist name", artist.Name, SyncLimits.MaxNameLength);
        }
    }

    internal static void RequireId(string field, string? id)
    {
        if (string.IsNullOrEmpty(id) || id.Length > SyncLimits.MaxIdLength || !RowId().IsMatch(id))
        {
            throw new DomainValidationException($"{field} \"{id}\" is not a valid id");
        }
    }

    /// <summary>
    /// Any short lowercase word (or empty), so devices that know newer sources
    /// can still sync with this API.
    /// </summary>
    private static void RequireSource(string kind, string id, string field, string? value)
    {
        if (value is not null && (value.Length > SyncLimits.MaxSourceLength || !Source().IsMatch(value)))
        {
            throw new DomainValidationException($"{kind} {id} has an invalid {field}");
        }
    }

    private static void MaxLength(string field, string? value, int limit)
    {
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

    [GeneratedRegex("^[a-z]*$")]
    private static partial Regex Source();
}
