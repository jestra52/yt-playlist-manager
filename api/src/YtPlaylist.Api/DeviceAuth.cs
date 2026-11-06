using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.Chains;
using JsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace YtPlaylist.Api;

/// <summary>Request helpers shared by the sync and sync chain endpoints.</summary>
internal static class DeviceAuth
{
    /// <summary>The token of an <c>Authorization: Bearer …</c> header, or null.</summary>
    public static string? BearerToken(HttpRequest request)
    {
        const string scheme = "Bearer ";
        var header = request.Headers.Authorization.ToString();
        return header.Length > scheme.Length && header.StartsWith(scheme, StringComparison.OrdinalIgnoreCase)
            ? header[scheme.Length..].Trim()
            : null;
    }

    /// <summary>
    /// Who a request counts against when rate limiting: the device, by a hash so the credential
    /// isn't kept in memory, or the IP address when it sends none.
    /// </summary>
    public static string RateLimitKey(HttpContext http) =>
        BearerToken(http.Request) is { } token
            ? Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)))
            : http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <summary>
    /// The device whose credential the request carries, or the error to answer with:
    /// 503 when sync chains aren't configured, 401 when the credential is missing or unknown.
    /// </summary>
    public static async Task<(DeviceContext? Device, IResult? Error)> AuthenticateAsync(
        HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return (null, NotConfigured());
        }
        var credential = BearerToken(http.Request);
        var device = credential is null ? null : await chains.AuthenticateAsync(credential, cancellationToken);
        return device is null ? (null, NotInAChain()) : (device, null);
    }

    /// <summary>The 401 for a credential that is unknown, or whose device was removed.</summary>
    public static IResult NotInAChain() => ApiResults.Error(
        StatusCodes.Status401Unauthorized,
        "this device isn't in a sync chain (it was removed, or the chain's code was replaced, recovered or deleted)");

    public static IResult NotConfigured() => ApiResults.Error(
        StatusCodes.Status503ServiceUnavailable,
        "sync is not configured on the server (set DATABASE_URL and SYNC_PEPPER)");

    /// <summary>Reads a JSON body, or returns the 400 error to answer with.</summary>
    public static async Task<(T? Body, IResult? Error)> ReadJsonAsync<T>(
        HttpContext http, IOptions<JsonOptions> jsonOptions, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            var body = await JsonSerializer.DeserializeAsync<T>(
                http.Request.Body, jsonOptions.Value.SerializerOptions, cancellationToken);
            return body is null
                ? (null, ApiResults.Error(StatusCodes.Status400BadRequest, "invalid JSON body: empty"))
                : (body, null);
        }
        catch (JsonException ex)
        {
            return (null, ApiResults.Error(StatusCodes.Status400BadRequest, $"invalid JSON body: {ex.Message}"));
        }
    }

    /// <summary>Keeps responses that carry a secret out of every cache.</summary>
    public static void NoStore(HttpResponse response) => response.Headers.CacheControl = "no-store";
}
