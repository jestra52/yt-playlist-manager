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
        return device is null
            ? (null, ApiResults.Error(
                StatusCodes.Status401Unauthorized,
                "this device isn't in a sync chain (it was removed, or the chain was replaced or deleted)"))
            : (device, null);
    }

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
