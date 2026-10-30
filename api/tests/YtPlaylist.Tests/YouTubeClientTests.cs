using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.YouTube;
using YtPlaylist.Domain.Common;
using YtPlaylist.Infrastructure.YouTube;

namespace YtPlaylist.Tests;

/// <summary>Answers HTTP requests from a function, so clients run without the network.</summary>
internal sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<Uri> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request.RequestUri!);
        return Task.FromResult(respond(request));
    }

    public static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    public static HttpResponseMessage Xml(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/atom+xml") };
}

public sealed class YouTubeClientTests
{
    private const string ListId = "PLabcdefghijklmnop1234";

    private static YouTubeOptions Options(string apiKey = "", int maxVideos = 10) => new()
    {
        ApiKey = apiKey,
        OEmbedEndpoint = new Uri("http://yt.test/oembed"),
        DataApiBase = new Uri("http://api.test/v3/"),
        FeedEndpoint = new Uri("http://yt.test/feeds/videos.xml"),
        MaxPlaylistVideos = maxVideos,
    };

    private static string Query(HttpRequestMessage request, string name) =>
        request.RequestUri!.Query.TrimStart('?').Split('&')
            .Select(p => p.Split('=', 2))
            .Where(p => p[0] == name)
            .Select(p => Uri.UnescapeDataString(p[1]))
            .FirstOrDefault() ?? "";

    [Fact]
    public async Task OEmbedReadsTitlesAndReportsMissingVideos()
    {
        using var handler = new StubHandler(request =>
            Query(request, "url") == "https://www.youtube.com/watch?v=aaaaaaaaaaa"
                ? new HttpResponseMessage(HttpStatusCode.NotFound)
                : StubHandler.Json("""{"title":"Never Gonna","author_name":"Rick","thumbnail_url":"https://i.ytimg.com/x.jpg"}"""));
        using var http = new HttpClient(handler);
        var client = new OEmbedClient(http, Microsoft.Extensions.Options.Options.Create(Options()));

        var video = await client.GetVideoAsync("dQw4w9WgXcQ", CancellationToken.None);
        Assert.Equal(new VideoMetadata("dQw4w9WgXcQ", "Never Gonna", "Rick", "https://i.ytimg.com/x.jpg"), video);
        await Assert.ThrowsAsync<YouTubeNotFoundException>(() => client.GetVideoAsync("aaaaaaaaaaa", CancellationToken.None));
        await Assert.ThrowsAsync<DomainValidationException>(() => client.GetVideoAsync("../../etc", CancellationToken.None));
    }

    [Fact]
    public async Task DataApiReadsEveryPageAndSkipsDeletedVideos()
    {
        using var handler = new StubHandler(request =>
        {
            Assert.Equal("k", Query(request, "key"));
            var path = request.RequestUri!.AbsolutePath;
            if (path.EndsWith("/playlists", StringComparison.Ordinal))
            {
                return Query(request, "id") == ListId
                    ? StubHandler.Json("""{"items":[{"snippet":{"title":"Road trip","channelTitle":"Juan"}}]}""")
                    : StubHandler.Json("""{"items":[]}""");
            }
            return Query(request, "pageToken") == ""
                ? StubHandler.Json("""
                    {"nextPageToken":"p2","items":[
                      {"snippet":{"title":"One","videoOwnerChannelTitle":"A","resourceId":{"videoId":"dQw4w9WgXcQ"},
                        "thumbnails":{"medium":{"url":"https://i.ytimg.com/vi/dQw4w9WgXcQ/mq.jpg"}}}},
                      {"snippet":{"title":"Deleted video","resourceId":{"videoId":"aaaaaaaaaaa"}}}]}
                    """)
                : StubHandler.Json("""
                    {"items":[{"snippet":{"title":"Two","videoOwnerChannelTitle":"B","resourceId":{"videoId":"9bZkp7q19f0"}}}]}
                    """);
        });
        using var http = new HttpClient(handler);
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options("k")));

        var playlist = await client.GetPlaylistAsync(ListId, CancellationToken.None);
        Assert.Equal(("Road trip", "Juan", "api", false, 1), (playlist.Title, playlist.Author, playlist.Source, playlist.Partial, playlist.Skipped));
        Assert.Equal(new[] { "dQw4w9WgXcQ", "9bZkp7q19f0" }, playlist.Videos.Select(v => v.YouTubeId));
        Assert.Equal("https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg", playlist.Videos[1].ThumbnailUrl);

        var limited = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options("k", maxVideos: 1)));
        var partial = await limited.GetPlaylistAsync(ListId, CancellationToken.None);
        Assert.True(partial.Partial);
        Assert.Single(partial.Videos);

        await Assert.ThrowsAsync<YouTubeNotFoundException>(() => client.GetPlaylistAsync("PLzzzzzzzzzzzzzzzzzz", CancellationToken.None));
    }

    [Theory]
    // Seen on real playlists with unavailable videos: the last page points to a page that is
    // empty and points to itself.
    [InlineData("""{"nextPageToken":"p3","items":[]}""", 3)]
    // A token that repeats while still returning items.
    [InlineData("""{"nextPageToken":"p2","items":[{"snippet":{"title":"Again","resourceId":{"videoId":"aaaaaaaaaaa"}}}]}""", 2)]
    public async Task DataApiStopsWhenPagingRepeats(string loopingPage, int pageRequests)
    {
        using var handler = new StubHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("/playlists", StringComparison.Ordinal))
            {
                return StubHandler.Json("""{"items":[{"snippet":{"title":"City Pop","channelTitle":"Juan"}}]}""");
            }
            return Query(request, "pageToken") switch
            {
                "" => StubHandler.Json("""
                    {"nextPageToken":"p2","items":[
                      {"snippet":{"title":"One","videoOwnerChannelTitle":"A","resourceId":{"videoId":"dQw4w9WgXcQ"}}}]}
                    """),
                "p2" when pageRequests == 3 => StubHandler.Json("""
                    {"nextPageToken":"p3","items":[
                      {"snippet":{"title":"Two","videoOwnerChannelTitle":"B","resourceId":{"videoId":"9bZkp7q19f0"}}}]}
                    """),
                _ => StubHandler.Json(loopingPage),
            };
        });
        using var http = new HttpClient(handler);
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options("k")));

        var playlist = await client.GetPlaylistAsync(ListId, CancellationToken.None);

        Assert.False(playlist.Partial);
        Assert.Equal("dQw4w9WgXcQ", playlist.Videos[0].YouTubeId);
        Assert.Equal(pageRequests, handler.Requests.Count(u => u.AbsolutePath.EndsWith("/playlistItems", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task DataApiStopsAtThePageCap()
    {
        var page = 0;
        using var handler = new StubHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("/playlists", StringComparison.Ordinal))
            {
                return StubHandler.Json("""{"items":[{"snippet":{"title":"Endless","channelTitle":"Juan"}}]}""");
            }
            // Every page has a new token and only unavailable videos, so neither the video limit
            // nor the repeat check ends the import.
            page++;
            return StubHandler.Json($$"""
                {"nextPageToken":"p{{page + 1}}","items":[{"snippet":{"title":"Gone","resourceId":{"videoId":"aaaaaaaaaaa"}}}]}
                """);
        });
        using var http = new HttpClient(handler);
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options("k")));

        var playlist = await client.GetPlaylistAsync(ListId, CancellationToken.None);

        Assert.True(playlist.Partial);
        Assert.Empty(playlist.Videos);
        Assert.Equal(YouTubePlaylistClient.MaxDataApiPages, page);
    }

    [Fact]
    public async Task DataApiErrorsMapToNotFoundOrUnavailable()
    {
        using var handler = new StubHandler(request => Query(request, "id") == "PLprivateprivate"
            ? StubHandler.Json("""{"error":{"code":403,"errors":[{"reason":"playlistItemsNotAccessible"}]}}""", HttpStatusCode.Forbidden)
            : StubHandler.Json("""{"error":{"code":403,"errors":[{"reason":"quotaExceeded"}],"message":"quota"}}""", HttpStatusCode.Forbidden));
        using var http = new HttpClient(handler);
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options("k")));

        await Assert.ThrowsAsync<YouTubeNotFoundException>(() => client.GetPlaylistAsync("PLprivateprivate", CancellationToken.None));
        await Assert.ThrowsAsync<YouTubeUnavailableException>(() => client.GetPlaylistAsync(ListId, CancellationToken.None));
    }

    [Fact]
    public async Task FeedIsUsedWithoutAnApiKey()
    {
        using var handler = new StubHandler(request => Query(request, "playlist_id") == ListId
            ? StubHandler.Xml("""
                <?xml version="1.0" encoding="UTF-8"?>
                <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
                  <title>Road trip</title>
                  <author><name>Juan</name></author>
                  <entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><title>One &amp; only</title><author><name>A</name></author></entry>
                  <entry><yt:videoId>9bZkp7q19f0</yt:videoId><title>Two</title><author><name>B</name></author></entry>
                </feed>
                """)
            : new HttpResponseMessage(HttpStatusCode.NotFound));
        using var http = new HttpClient(handler);
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options()));

        var playlist = await client.GetPlaylistAsync(ListId, CancellationToken.None);
        Assert.Equal(("Road trip", "Juan", "feed", false), (playlist.Title, playlist.Author, playlist.Source, playlist.Partial));
        Assert.Equal("One & only", playlist.Videos[0].Title);
        Assert.Equal(2, playlist.Videos.Count);
        await Assert.ThrowsAsync<YouTubeNotFoundException>(() => client.GetPlaylistAsync("PLzzzzzzzzzzzzzzzzzz", CancellationToken.None));
    }

    [Theory]
    [InlineData("")]
    [InlineData("WL")]
    [InlineData("../../etc/passwd")]
    [InlineData("PL with spaces")]
    public async Task RejectsInvalidPlaylistIds(string id)
    {
        using var http = new HttpClient(new StubHandler(_ => throw new InvalidOperationException("no request expected")));
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options()));
        await Assert.ThrowsAsync<DomainValidationException>(() => client.GetPlaylistAsync(id, CancellationToken.None));
    }

    [Fact]
    public async Task RejectsMixes()
    {
        using var http = new HttpClient(new StubHandler(_ => throw new InvalidOperationException("no request expected")));
        var client = new YouTubePlaylistClient(http, Microsoft.Extensions.Options.Options.Create(Options()));
        await Assert.ThrowsAsync<PlaylistNotSupportedException>(() => client.GetPlaylistAsync("RDdQw4w9WgXcQ", CancellationToken.None));
    }
}
