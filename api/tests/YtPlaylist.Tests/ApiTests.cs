using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using YtPlaylist.Application.Sync;
using YtPlaylist.Application.YouTube;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Tests;

internal sealed class FakeSyncStore : ISyncStore
{
    public List<ChangeSet> Applied { get; } = [];
    public long? LastSince { get; private set; }
    public bool Fail { get; init; }

    public Task<int> ApplyAsync(ChangeSet changes, CancellationToken cancellationToken)
    {
        if (this.Fail)
        {
            throw new InvalidOperationException("boom");
        }
        this.Applied.Add(changes);
        return Task.FromResult(changes.Count);
    }

    public Task<ChangePage> GetChangesAsync(long since, int limit, CancellationToken cancellationToken)
    {
        this.LastSince = since;
        var remote = new PlaylistChange { Id = "p1", Name = "Remote", CreatedAt = 1, UpdatedAt = 2 };
        return Task.FromResult(new ChangePage(new ChangeSet { Playlists = [remote] }, 42, false));
    }
}

internal sealed class FakeYouTube : IVideoMetadataSource, IYouTubePlaylistSource
{
    public Task<VideoMetadata> GetVideoAsync(string youTubeId, CancellationToken cancellationToken) => youTubeId switch
    {
        "aaaaaaaaaaa" => throw new YouTubeNotFoundException("video not found or not embeddable"),
        _ when !YouTubeIds.IsVideoId(youTubeId) => throw new DomainValidationException("invalid youtube id"),
        _ => Task.FromResult(new VideoMetadata(youTubeId, $"Title {youTubeId}", "Channel", "")),
    };

    public Task<YouTubePlaylist> GetPlaylistAsync(string playlistId, CancellationToken cancellationToken) => playlistId switch
    {
        "PLprivateprivate" => throw new YouTubeNotFoundException("playlist not found, or it is private"),
        "PLbrokenbroken" => throw new YouTubeUnavailableException("upstream down"),
        "bad" => throw new DomainValidationException("invalid playlist id"),
        _ => Task.FromResult(new YouTubePlaylist(
            playlistId, "Road trip", "Juan", [new VideoMetadata("dQw4w9WgXcQ", "One", "A", "")], 0, false, "feed")),
    };
}

public sealed class ApiTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private HttpClient Client(ISyncStore? store = null, string syncToken = "secret") =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("SYNC_TOKEN", syncToken);
            builder.ConfigureTestServices(services =>
            {
                if (store is not null)
                {
                    services.AddSingleton(store);
                }
                var youTube = new FakeYouTube();
                services.AddSingleton<IVideoMetadataSource>(youTube);
                services.AddSingleton<IYouTubePlaylistSource>(youTube);
            });
        }).CreateClient();

    private static HttpRequestMessage SyncRequest(string body, string? token)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/sync")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return request;
    }

    [Fact]
    public async Task HealthReportsWhetherSyncIsConfigured()
    {
        using var configured = this.Client(new FakeSyncStore());
        var body = await configured.GetFromJsonAsync<JsonElement>("/api/health");
        Assert.True(body.GetProperty("ok").GetBoolean());
        Assert.True(body.GetProperty("syncConfigured").GetBoolean());

        using var bare = this.Client();
        body = await bare.GetFromJsonAsync<JsonElement>("/api/health");
        Assert.False(body.GetProperty("syncConfigured").GetBoolean());
    }

    [Fact]
    public async Task SyncRequiresAToken()
    {
        using var client = this.Client(new FakeSyncStore());
        using var missing = await client.SendAsync(SyncRequest("{}", null));
        Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
        using var wrong = await client.SendAsync(SyncRequest("{}", "wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
    }

    [Fact]
    public async Task SyncIsUnavailableWithoutADatabase()
    {
        using var client = this.Client();
        using var response = await client.SendAsync(SyncRequest("{}", "secret"));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("not configured", body.GetProperty("error").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task SyncAppliesChangesAndReturnsServerChanges()
    {
        var store = new FakeSyncStore();
        using var client = this.Client(store);
        const string body = /*lang=json,strict*/ """
            {"since":7,"changes":{
              "playlists":[{"id":"p2","name":"Mine","createdAt":1,"updatedAt":5}],
              "videos":[{"id":"v1","playlistId":"p2","youtubeId":"dQw4w9WgXcQ","createdAt":1,"updatedAt":5}]}}
            """;
        using var response = await client.SendAsync(SyncRequest(body, "secret"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(42, json.GetProperty("cursor").GetInt64());
        Assert.False(json.GetProperty("hasMore").GetBoolean());
        Assert.Equal(2, json.GetProperty("applied").GetInt32());
        Assert.Equal("Remote", json.GetProperty("changes").GetProperty("playlists")[0].GetProperty("name").GetString());
        Assert.False(json.GetProperty("changes").TryGetProperty("count", out _));

        Assert.Equal(7, store.LastSince);
        var applied = Assert.Single(store.Applied);
        Assert.Equal("dQw4w9WgXcQ", Assert.Single(applied.Videos).YouTubeId);
    }

    [Theory]
    [InlineData(/*lang=json,strict*/ """{"since":0,"changes":{"videos":[{"id":"v1","playlistId":"p","youtubeId":"nope","createdAt":1,"updatedAt":1}]}}""")]
    [InlineData(/*lang=json,strict*/ """{"since":-1}""")]
    [InlineData("not json")]
    public async Task SyncRejectsInvalidRequests(string body)
    {
        using var client = this.Client(new FakeSyncStore());
        using var response = await client.SendAsync(SyncRequest(body, "secret"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SyncReportsStoreFailures()
    {
        using var client = this.Client(new FakeSyncStore { Fail = true });
        const string body = /*lang=json,strict*/ """{"since":0,"changes":{"playlists":[{"id":"p","name":"x","createdAt":1,"updatedAt":1}]}}""";
        using var response = await client.SendAsync(SyncRequest(body, "secret"));
        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/oembed?id=dQw4w9WgXcQ", HttpStatusCode.OK)]
    [InlineData("/api/oembed?id=bad", HttpStatusCode.BadRequest)]
    [InlineData("/api/oembed?id=aaaaaaaaaaa", HttpStatusCode.NotFound)]
    [InlineData("/api/playlist?id=PLabcdefghijklmnop", HttpStatusCode.OK)]
    [InlineData("/api/playlist?id=PLprivateprivate", HttpStatusCode.NotFound)]
    [InlineData("/api/playlist?id=PLbrokenbroken", HttpStatusCode.BadGateway)]
    [InlineData("/api/playlist?id=bad", HttpStatusCode.BadRequest)]
    [InlineData("/api/nope", HttpStatusCode.NotFound)]
    public async Task YouTubeEndpointsMapErrorsToStatusCodes(string path, HttpStatusCode expected)
    {
        using var client = this.Client();
        using var response = await client.GetAsync(new Uri(path, UriKind.Relative));
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task UsesTheWebAppsJsonNames()
    {
        using var client = this.Client();
        var video = await client.GetFromJsonAsync<JsonElement>("/api/oembed?id=dQw4w9WgXcQ");
        Assert.Equal("dQw4w9WgXcQ", video.GetProperty("youtubeId").GetString());

        var playlist = await client.GetFromJsonAsync<JsonElement>("/api/playlist?id=PLabcdefghijklmnop");
        Assert.Equal("Road trip", playlist.GetProperty("title").GetString());
        Assert.Equal("dQw4w9WgXcQ", playlist.GetProperty("videos")[0].GetProperty("youtubeId").GetString());
        Assert.Equal("feed", playlist.GetProperty("source").GetString());
    }

    [Fact]
    public async Task AnswersCorsPreflight()
    {
        using var client = this.Client();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/sync");
        request.Headers.Add("Origin", "https://example.netlify.app");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("*", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }
}
