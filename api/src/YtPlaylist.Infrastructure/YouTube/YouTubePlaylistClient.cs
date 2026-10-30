using System.Net;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.YouTube;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>
/// Reads public playlists. With an API key it uses the YouTube Data API and reads the
/// whole playlist; without one it falls back to YouTube's public playlist feed, which
/// only lists the most recent videos.
/// </summary>
public sealed class YouTubePlaylistClient(HttpClient http, IOptions<YouTubeOptions> options) : IYouTubePlaylistSource
{
    /// <summary>How many entries YouTube's public feed returns at most.</summary>
    internal const int FeedPageSize = 15;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly XNamespace Atom = "http://www.w3.org/2005/Atom";
    private static readonly XNamespace Yt = "http://www.youtube.com/xml/schemas/2015";

    /// <summary>
    /// The Data API returns at most 50 items per page and a playlist holds at most 5,000 videos,
    /// so a real playlist never needs more pages than this.
    /// </summary>
    internal const int MaxDataApiPages = 100;

    public async Task<YouTubePlaylist> GetPlaylistAsync(string playlistId, CancellationToken cancellationToken)
    {
        if (!YouTubeIds.IsPlaylistId(playlistId))
        {
            throw new DomainValidationException("invalid playlist id");
        }
        // RD… lists are auto-generated mixes; they can't be read without signing in.
        if (playlistId.StartsWith("RD", StringComparison.Ordinal))
        {
            throw new PlaylistNotSupportedException();
        }

        // One deadline for the whole import, so a slow or misbehaving YouTube can't keep a
        // request (and its quota use) going after the caller has given up.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(options.Value.PlaylistTimeout);
        try
        {
            return string.IsNullOrEmpty(options.Value.ApiKey)
                ? await this.FromFeedAsync(playlistId, deadline.Token)
                : await this.FromDataApiAsync(playlistId, deadline.Token);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new YouTubeUnavailableException("reading the playlist from YouTube took too long", ex);
        }
    }

    // ---- YouTube Data API ------------------------------------------------

    private async Task<YouTubePlaylist> FromDataApiAsync(string id, CancellationToken cancellationToken)
    {
        var info = await this.DataApiGetAsync<PlaylistListResponse>(
            $"playlists?part=snippet&id={Uri.EscapeDataString(id)}", cancellationToken);
        var snippet = (info.Items is { Count: > 0 } items ? items[0] : null)?.Snippet
            ?? throw new YouTubeNotFoundException("playlist not found, or it is private");

        var limit = options.Value.MaxPlaylistVideos > 0 ? options.Value.MaxPlaylistVideos : 1000;
        var videos = new List<VideoMetadata>();
        var skipped = 0;
        var pages = 0;
        var seenTokens = new HashSet<string>(StringComparer.Ordinal);
        string? pageToken = null;
        while (true)
        {
            var path = $"playlistItems?part=snippet&maxResults=50&playlistId={Uri.EscapeDataString(id)}";
            if (pageToken is not null)
            {
                path += $"&pageToken={Uri.EscapeDataString(pageToken)}";
            }
            var page = await this.DataApiGetAsync<PlaylistItemListResponse>(path, cancellationToken);
            pages++;
            foreach (var item in page.Items ?? [])
            {
                var s = item.Snippet;
                var videoId = s?.ResourceId?.VideoId;
                // Deleted and private videos have no owner channel.
                if (s is null || string.IsNullOrEmpty(s.VideoOwnerChannelTitle) || !YouTubeIds.IsVideoId(videoId))
                {
                    skipped++;
                    continue;
                }
                if (videos.Count == limit)
                {
                    return new YouTubePlaylist(id, snippet.Title ?? "", snippet.ChannelTitle ?? "", videos, skipped, true, "api");
                }
                var thumbnail = s.Thumbnails is not null && s.Thumbnails.TryGetValue("medium", out var medium)
                    ? medium.Url
                    : null;
                videos.Add(new VideoMetadata(videoId, s.Title ?? "", s.VideoOwnerChannelTitle, Thumbnail(videoId, thumbnail)));
            }

            // Once a playlist has unavailable videos, the Data API can keep answering with the same
            // nextPageToken and no items, forever. Stop on an empty page or a token seen before.
            var next = page.NextPageToken;
            if (string.IsNullOrEmpty(next) || page.Items is not { Count: > 0 } || !seenTokens.Add(next))
            {
                break;
            }
            if (pages == MaxDataApiPages)
            {
                return new YouTubePlaylist(id, snippet.Title ?? "", snippet.ChannelTitle ?? "", videos, skipped, true, "api");
            }
            pageToken = next;
        }

        return new YouTubePlaylist(id, snippet.Title ?? "", snippet.ChannelTitle ?? "", videos, skipped, false, "api");
    }

    private async Task<T> DataApiGetAsync<T>(string pathAndQuery, CancellationToken cancellationToken)
    {
        var key = Uri.EscapeDataString(options.Value.ApiKey);
        var url = new Uri(options.Value.DataApiBase, $"{pathAndQuery}&key={key}");
        using var response = await http.GetAsync(url, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            ApiErrorResponse? error = null;
            try
            {
                error = JsonSerializer.Deserialize<ApiErrorResponse>(body, Json);
            }
            catch (JsonException)
            {
                // Not a Data API error body; reported below with the status code.
            }
            var reason = (error?.Error?.Errors is { Count: > 0 } errors ? errors[0] : null)?.Reason ?? "";
            if (response.StatusCode == HttpStatusCode.NotFound
                || reason is "playlistItemsNotAccessible" or "playlistNotFound")
            {
                throw new YouTubeNotFoundException("playlist not found, or it is private");
            }
            throw new YouTubeUnavailableException(
                $"youtube api http {(int)response.StatusCode} {reason}: {error?.Error?.Message}");
        }
        return JsonSerializer.Deserialize<T>(body, Json)
            ?? throw new YouTubeUnavailableException("youtube api returned an empty body");
    }

    // ---- Public feed (no API key) ----------------------------------------

    private async Task<YouTubePlaylist> FromFeedAsync(string id, CancellationToken cancellationToken)
    {
        var url = new Uri($"{options.Value.FeedEndpoint}?playlist_id={Uri.EscapeDataString(id)}");
        using var response = await http.GetAsync(url, cancellationToken);
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
        {
            throw new YouTubeNotFoundException("playlist not found, or it is private");
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new YouTubeUnavailableException($"youtube feed http {(int)response.StatusCode}");
        }

        XDocument feed;
        await using (var stream = await response.Content.ReadAsStreamAsync(cancellationToken))
        {
            // No DTDs or external entities from a remote document.
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, Async = true };
            using var reader = XmlReader.Create(stream, settings);
            try
            {
                feed = await XDocument.LoadAsync(reader, LoadOptions.None, cancellationToken);
            }
            catch (XmlException ex)
            {
                throw new YouTubeUnavailableException("youtube feed is not valid XML", ex);
            }
        }

        var root = feed.Root!;
        var entries = root.Elements(Atom + "entry").ToList();
        var videos = new List<VideoMetadata>();
        var skipped = 0;
        foreach (var entry in entries)
        {
            var videoId = (string?)entry.Element(Yt + "videoId");
            if (!YouTubeIds.IsVideoId(videoId))
            {
                skipped++;
                continue;
            }
            videos.Add(new VideoMetadata(
                videoId!,
                (string?)entry.Element(Atom + "title") ?? "",
                (string?)entry.Element(Atom + "author")?.Element(Atom + "name") ?? "",
                Thumbnail(videoId!, null)));
        }
        return new YouTubePlaylist(
            id,
            (string?)root.Element(Atom + "title") ?? "",
            (string?)root.Element(Atom + "author")?.Element(Atom + "name") ?? "",
            videos,
            skipped,
            // The feed stops at its page size, so a full page means there may be more.
            entries.Count >= FeedPageSize,
            "feed");
    }

    private static string Thumbnail(string videoId, string? fromApi) =>
        string.IsNullOrEmpty(fromApi) ? $"https://i.ytimg.com/vi/{videoId}/mqdefault.jpg" : fromApi;

    // ---- Data API response shapes ------------------------------------------

    private sealed record PlaylistListResponse(IReadOnlyList<PlaylistResource>? Items);

    private sealed record PlaylistResource(PlaylistSnippet? Snippet);

    private sealed record PlaylistSnippet(string? Title, string? ChannelTitle);

    private sealed record PlaylistItemListResponse(string? NextPageToken, IReadOnlyList<PlaylistItemResource>? Items);

    private sealed record PlaylistItemResource(PlaylistItemSnippet? Snippet);

    private sealed record PlaylistItemSnippet(
        string? Title,
        string? VideoOwnerChannelTitle,
        ResourceId? ResourceId,
        IReadOnlyDictionary<string, ThumbnailInfo>? Thumbnails);

    private sealed record ResourceId(string? VideoId);

    private sealed record ThumbnailInfo(string? Url);

    private sealed record ApiErrorResponse(ApiError? Error);

    private sealed record ApiError(int Code, string? Message, IReadOnlyList<ApiErrorItem>? Errors);

    private sealed record ApiErrorItem(string? Reason);
}
