using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Application.YouTube;

namespace YtPlaylist.Tests;

public sealed class ApiTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Pepper = "test-pepper-test-pepper-test-pepper-0123";

    /// <summary>
    /// A client for the API. With <paramref name="store"/>, sync is configured: a pepper, the given
    /// sync store and an in-memory chain store (<paramref name="chains"/>, or a new one).
    /// </summary>
    private HttpClient Client(
        ISyncStore? store = null, string syncToken = "secret", FakeChainStore? chains = null, ListLoggerProvider? logs = null) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("SYNC_TOKEN", syncToken);
            if (store is not null)
            {
                builder.UseSetting("SYNC_PEPPER", Pepper);
            }
            if (logs is not null)
            {
                builder.ConfigureLogging(logging => logging.AddProvider(logs));
            }
            builder.ConfigureTestServices(services =>
            {
                if (store is not null)
                {
                    services.AddSingleton(store);
                    services.AddSingleton<IChainStore>(chains ?? new FakeChainStore());
                }
                var youTube = new FakeYouTube();
                services.AddSingleton<IVideoMetadataSource>(youTube);
                services.AddSingleton<IYouTubePlaylistSource>(youTube);
            });
        }).CreateClient();

    private static HttpRequestMessage SyncRequest(string body, string? token) =>
        Request(HttpMethod.Post, "/api/sync", body, token);

    private static HttpRequestMessage Request(HttpMethod method, string path, string? body = null, string? token = null)
    {
        var request = new HttpRequestMessage(method, new Uri(path, UriKind.Relative));
        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return request;
    }

    /// <summary>Creates a sync chain and returns the response body (chainId, deviceId, deviceCredential, secret).</summary>
    private static async Task<JsonElement> CreateChainAsync(HttpClient client, string deviceName = "Laptop")
    {
        using var response = await client.SendAsync(Request(HttpMethod.Post, "/api/chains", $$"""{"deviceName":"{{deviceName}}"}"""));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static string Credential(JsonElement access) => access.GetProperty("deviceCredential").GetString()!;

    private static List<string> RecoveryCodes(JsonElement body, string property = "recoveryCodes") =>
        [.. body.GetProperty(property).EnumerateArray().Select(c => c.GetString()!)];

    private static Task<HttpResponseMessage> RecoverAsync(HttpClient client, string code, string deviceName = "New phone") =>
        client.SendAsync(Request(HttpMethod.Post, "/api/chains/recover", $$"""{"recoveryCode":"{{code}}","deviceName":"{{deviceName}}"}"""));

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
    public async Task SyncRequiresADeviceCredential()
    {
        using var client = this.Client(new FakeSyncStore());
        using var missing = await client.SendAsync(SyncRequest("{}", null));
        Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
        using var wrong = await client.SendAsync(SyncRequest("{}", "wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);

        // The old shared token is not a device credential.
        using var oldToken = await client.SendAsync(SyncRequest("{}", "secret"));
        Assert.Equal(HttpStatusCode.Unauthorized, oldToken.StatusCode);
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
        var access = await CreateChainAsync(client);
        const string body = /*lang=json,strict*/ """
            {"since":7,"changes":{
              "playlists":[{"id":"p2","name":"Mine","createdAt":1,"updatedAt":5}],
              "videos":[{"id":"v1","playlistId":"p2","youtubeId":"dQw4w9WgXcQ","artist":"Anri","artistSource":"guess","createdAt":1,"updatedAt":5}]}}
            """;
        using var response = await client.SendAsync(SyncRequest(body, Credential(access)));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(access.GetProperty("chainId").GetString(), store.LastChainId);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(42, json.GetProperty("cursor").GetInt64());
        Assert.False(json.GetProperty("hasMore").GetBoolean());
        Assert.Equal(2, json.GetProperty("applied").GetInt32());
        Assert.Equal("Remote", json.GetProperty("changes").GetProperty("playlists")[0].GetProperty("name").GetString());
        Assert.False(json.GetProperty("changes").TryGetProperty("count", out _));

        Assert.Equal(7, store.LastSince);
        var applied = Assert.Single(store.Applied);
        var video = Assert.Single(applied.Videos);
        Assert.Equal("dQw4w9WgXcQ", video.YouTubeId);
        Assert.Equal(("Anri", "guess"), (video.Artist, video.ArtistSource));
    }

    [Theory]
    [InlineData(/*lang=json,strict*/ """{"since":0,"changes":{"videos":[{"id":"v1","playlistId":"p","youtubeId":"nope","createdAt":1,"updatedAt":1}]}}""")]
    [InlineData(/*lang=json,strict*/ """{"since":-1}""")]
    [InlineData("not json")]
    public async Task SyncRejectsInvalidRequests(string body)
    {
        using var client = this.Client(new FakeSyncStore());
        var access = await CreateChainAsync(client);
        using var response = await client.SendAsync(SyncRequest(body, Credential(access)));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SyncReportsStoreFailures()
    {
        using var client = this.Client(new FakeSyncStore { Fail = true });
        var access = await CreateChainAsync(client);
        const string body = /*lang=json,strict*/ """{"since":0,"changes":{"playlists":[{"id":"p","name":"x","createdAt":1,"updatedAt":1}]}}""";
        using var response = await client.SendAsync(SyncRequest(body, Credential(access)));
        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
    }

    [Fact]
    public async Task ChainsAreCreatedJoinedManagedAndReplaced()
    {
        using var client = this.Client(new FakeSyncStore());

        using var created = await client.SendAsync(Request(HttpMethod.Post, "/api/chains", """{"deviceName":"Laptop"}"""));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("no-store", created.Headers.CacheControl?.ToString());
        var laptop = await created.Content.ReadFromJsonAsync<JsonElement>();
        var secret = laptop.GetProperty("secret").GetString()!;
        Assert.Equal(43, secret.Length);
        Assert.Equal(43, Credential(laptop).Length);
        Assert.Equal(10, RecoveryCodes(laptop).Count);

        // Join with the code's secret; a wrong one doesn't say whether a chain exists.
        using var joined = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{secret}}","deviceName":"Phone"}"""));
        Assert.Equal(HttpStatusCode.OK, joined.StatusCode);
        var phone = await joined.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(laptop.GetProperty("chainId").GetString(), phone.GetProperty("chainId").GetString());
        Assert.Equal(JsonValueKind.Null, phone.GetProperty("secret").ValueKind);
        Assert.Equal(JsonValueKind.Null, phone.GetProperty("recoveryCodes").ValueKind);
        using var wrong = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{new string('A', 43)}}","deviceName":"X"}"""));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);

        using var described = await client.SendAsync(Request(HttpMethod.Get, "/api/chain", token: Credential(phone)));
        var info = await described.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(phone.GetProperty("deviceId").GetString(), info.GetProperty("deviceId").GetString());
        Assert.Equal(["Laptop", "Phone"], info.GetProperty("devices").EnumerateArray().Select(d => d.GetProperty("name").GetString()));
        Assert.DoesNotContain("credential", await described.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        // A new code: the old one stops working, and so does every other device.
        // The recovery codes are renewed too.
        using var replaced = await client.SendAsync(Request(HttpMethod.Post, "/api/chain/replace", token: Credential(laptop)));
        var replacement = await replaced.Content.ReadFromJsonAsync<JsonElement>();
        var newSecret = replacement.GetProperty("secret").GetString()!;
        Assert.NotEqual(secret, newSecret);
        Assert.Empty(RecoveryCodes(replacement).Intersect(RecoveryCodes(laptop)));
        using var oldRecoveryCode = await RecoverAsync(client, RecoveryCodes(laptop)[0]);
        Assert.Equal(HttpStatusCode.Unauthorized, oldRecoveryCode.StatusCode);
        using var phoneAfter = await client.SendAsync(SyncRequest("{}", Credential(phone)));
        Assert.Equal(HttpStatusCode.Unauthorized, phoneAfter.StatusCode);
        using var oldCode = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{secret}}","deviceName":"Phone"}"""));
        Assert.Equal(HttpStatusCode.Unauthorized, oldCode.StatusCode);
        using var rejoined = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{newSecret}}","deviceName":"Phone"}"""));
        var phone2 = await rejoined.Content.ReadFromJsonAsync<JsonElement>();

        // Remove a device, then delete the chain.
        using var removed = await client.SendAsync(Request(HttpMethod.Delete, $"/api/chain/devices/{phone2.GetProperty("deviceId").GetString()}", token: Credential(laptop)));
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        using var removedAgain = await client.SendAsync(Request(HttpMethod.Delete, $"/api/chain/devices/{phone2.GetProperty("deviceId").GetString()}", token: Credential(laptop)));
        Assert.Equal(HttpStatusCode.NotFound, removedAgain.StatusCode);
        using var deleted = await client.SendAsync(Request(HttpMethod.Delete, "/api/chain", token: Credential(laptop)));
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var afterDelete = await client.SendAsync(Request(HttpMethod.Get, "/api/chain", token: Credential(laptop)));
        Assert.Equal(HttpStatusCode.Unauthorized, afterDelete.StatusCode);
    }

    [Fact]
    public async Task AChainIsRecoveredOnceWithARecoveryCode()
    {
        var logs = new ListLoggerProvider();
        var chains = new FakeChainStore();
        using var client = this.Client(new FakeSyncStore(), chains: chains, logs: logs);
        var laptop = await CreateChainAsync(client, "Laptop");
        var chainId = laptop.GetProperty("chainId").GetString();
        using var joined = await client.SendAsync(Request(
            HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{laptop.GetProperty("secret").GetString()}}","deviceName":"Phone"}"""));
        var phone = await joined.Content.ReadFromJsonAsync<JsonElement>();
        var codes = RecoveryCodes(laptop);
        Assert.All(codes, c => Assert.Matches("^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$", c));
        Assert.Equal(10, codes.Distinct().Count());

        // Typed in lower case without dashes still works; the device joins the same chain.
        using var recovered = await RecoverAsync(client, codes[3].Replace("-", "", StringComparison.Ordinal).ToLowerInvariant());
        Assert.Equal(HttpStatusCode.OK, recovered.StatusCode);
        Assert.Equal("no-store", recovered.Headers.CacheControl?.ToString());
        var newPhone = await recovered.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(chainId, newPhone.GetProperty("chainId").GetString());
        var newSecret = newPhone.GetProperty("secret").GetString()!;
        Assert.NotEqual(laptop.GetProperty("secret").GetString(), newSecret);
        var newCodes = RecoveryCodes(newPhone);
        Assert.Equal(10, newCodes.Count);
        Assert.Empty(newCodes.Intersect(codes));

        // Every old device, the old code and every old recovery code stop working.
        foreach (var old in new[] { laptop, phone })
        {
            using var refused = await client.SendAsync(SyncRequest("{}", Credential(old)));
            Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
            Assert.Contains("recovered", await refused.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }
        using var oldCode = await client.SendAsync(Request(
            HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{laptop.GetProperty("secret").GetString()}}","deviceName":"X"}"""));
        Assert.Equal(HttpStatusCode.Unauthorized, oldCode.StatusCode);
        using var usedAgain = await RecoverAsync(client, codes[3]);
        Assert.Equal(HttpStatusCode.Unauthorized, usedAgain.StatusCode);
        using var anotherOld = await RecoverAsync(client, codes[0]);
        Assert.Equal(HttpStatusCode.Unauthorized, anotherOld.StatusCode);

        // The new device is the only one; the chain (and so its data) is the same.
        using var described = await client.SendAsync(Request(HttpMethod.Get, "/api/chain", token: Credential(newPhone)));
        var info = await described.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(["New phone"], info.GetProperty("devices").EnumerateArray().Select(d => d.GetProperty("name").GetString()));
        Assert.Equal(10, info.GetProperty("recoveryCodesLeft").GetInt32());
        Assert.Single(chains.Chains, c => c.Id == chainId);

        // No code or secret ever reaches the logs.
        var logged = string.Join('\n', logs.Messages);
        Assert.Contains("recovery attempt failed", logged, StringComparison.Ordinal);
        foreach (var secret in codes.Concat(newCodes).Append(newSecret))
        {
            Assert.DoesNotContain(secret, logged, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(secret.Replace("-", "", StringComparison.Ordinal), logged, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("ABCDE-FGHIJ")]
    [InlineData("UUUUU-UUUUU-UUUUU-UUUUU")]
    public async Task MalformedRecoveryCodesAreRefused(string code)
    {
        using var client = this.Client(new FakeSyncStore());
        using var response = await RecoverAsync(client, code);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RecoveryIsRateLimitedMoreStrictlyThanJoining()
    {
        using var client = this.Client(new FakeSyncStore());
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 7; i++)
        {
            using var response = await RecoverAsync(client, "00000-00000-00000-00000");
            statuses.Add(response.StatusCode);
        }
        Assert.Equal(5, statuses.Count(s => s == HttpStatusCode.Unauthorized));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
    }

    [Fact]
    public async Task RecoveryCodesAreRenewedAndTheAuditLogHasNoSecrets()
    {
        using var client = this.Client(new FakeSyncStore());
        var laptop = await CreateChainAsync(client, "Laptop");
        var other = await CreateChainAsync(client, "Someone else");
        using var joined = await client.SendAsync(Request(
            HttpMethod.Post, "/api/chains/join", $$"""{"secret":"{{laptop.GetProperty("secret").GetString()}}","deviceName":"Phone"}"""));
        var phone = await joined.Content.ReadFromJsonAsync<JsonElement>();

        using var renewed = await client.SendAsync(Request(HttpMethod.Post, "/api/chain/recovery-codes", token: Credential(phone)));
        Assert.Equal(HttpStatusCode.OK, renewed.StatusCode);
        Assert.Equal("no-store", renewed.Headers.CacheControl?.ToString());
        var newCodes = RecoveryCodes(await renewed.Content.ReadFromJsonAsync<JsonElement>(), "codes");
        Assert.Equal(10, newCodes.Count);
        using var voided = await RecoverAsync(client, RecoveryCodes(laptop)[0]);
        Assert.Equal(HttpStatusCode.Unauthorized, voided.StatusCode);

        using var removed = await client.SendAsync(Request(
            HttpMethod.Delete, $"/api/chain/devices/{phone.GetProperty("deviceId").GetString()}", token: Credential(laptop)));
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);

        using var events = await client.SendAsync(Request(HttpMethod.Get, "/api/chain/events", token: Credential(laptop)));
        Assert.Equal(HttpStatusCode.OK, events.StatusCode);
        var text = await events.Content.ReadAsStringAsync();
        var log = JsonSerializer.Deserialize<JsonElement>(text).EnumerateArray().ToList();
        Assert.Equal(
            ["device_removed", "recovery_codes_renewed", "device_joined", "created"],
            log.Select(e => e.GetProperty("kind").GetString()));
        Assert.Equal("Laptop", log[0].GetProperty("deviceName").GetString());
        Assert.Equal("Phone", log[0].GetProperty("detail").GetString());
        Assert.Equal("Phone", log[1].GetProperty("deviceName").GetString());
        foreach (var secret in newCodes.Concat(RecoveryCodes(laptop)).Append(laptop.GetProperty("secret").GetString()!).Append(Credential(laptop)))
        {
            Assert.DoesNotContain(secret, text, StringComparison.Ordinal);
        }
        Assert.DoesNotContain("Someone else", text, StringComparison.Ordinal);

        using var limited = await client.SendAsync(Request(HttpMethod.Get, "/api/chain/events?limit=1", token: Credential(laptop)));
        Assert.Single((await limited.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray());
        using var otherLog = await client.SendAsync(Request(HttpMethod.Get, "/api/chain/events", token: Credential(other)));
        Assert.Equal(["created"], (await otherLog.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().Select(e => e.GetProperty("kind").GetString()));
    }

    [Fact]
    public async Task TheLibraryFromTheSyncTokenIsClaimedOnce()
    {
        using var client = this.Client(new FakeSyncStore());
        const string body = """{"deviceName":"Old laptop"}""";

        using var noToken = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/claim", body));
        Assert.Equal(HttpStatusCode.Unauthorized, noToken.StatusCode);
        using var claimed = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/claim", body, "secret"));
        Assert.Equal(HttpStatusCode.OK, claimed.StatusCode);
        var access = await claimed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("legacy", access.GetProperty("chainId").GetString());
        Assert.Equal(43, access.GetProperty("secret").GetString()!.Length);
        Assert.Equal(10, RecoveryCodes(access).Count);
        using var again = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/claim", body, "secret"));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);

        using var noLegacyToken = this.Client(new FakeSyncStore(), syncToken: "");
        using var notFound = await noLegacyToken.SendAsync(Request(HttpMethod.Post, "/api/chains/claim", body, "anything"));
        Assert.Equal(HttpStatusCode.NotFound, notFound.StatusCode);
    }

    [Fact]
    public async Task JoiningIsRateLimited()
    {
        using var client = this.Client(new FakeSyncStore());
        var body = $$"""{"secret":"{{new string('A', 43)}}","deviceName":"Guess"}""";
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 12; i++)
        {
            using var response = await client.SendAsync(Request(HttpMethod.Post, "/api/chains/join", body));
            statuses.Add(response.StatusCode);
        }
        Assert.Equal(10, statuses.Count(s => s == HttpStatusCode.Unauthorized));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
    }

    [Fact]
    public async Task ChainsAreUnavailableWithoutAPepper()
    {
        using var client = this.Client();
        using var response = await client.SendAsync(Request(HttpMethod.Post, "/api/chains", """{"deviceName":"x"}"""));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
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
        Assert.Single(playlist.GetProperty("videos").EnumerateArray());

        var withDeleted = await client.GetFromJsonAsync<JsonElement>("/api/playlist?id=PLabcdefghijklmnop&includeUnavailable=true");
        var deleted = withDeleted.GetProperty("videos")[1];
        Assert.Equal("aaaaaaaaaaa", deleted.GetProperty("youtubeId").GetString());
        Assert.True(deleted.GetProperty("unavailable").GetBoolean());
        Assert.False(withDeleted.GetProperty("videos")[0].GetProperty("unavailable").GetBoolean());
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
