using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.Chains;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Chains;
using JsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace YtPlaylist.Api.Endpoints;

/// <summary>
/// Sync chains: one library per chain, joined with its code, with a credential per device.
/// The chain code's secret and device credentials appear only in the responses that create
/// them, are never logged, and are never cached (Cache-Control: no-store).
/// </summary>
public static class ChainEndpoints
{
    /// <summary>Rate limit policy for the endpoints that take or hand out secrets.</summary>
    public const string SecretsRateLimit = "chain-secrets";

    public static IEndpointRouteBuilder MapChainEndpoints(this IEndpointRouteBuilder app)
    {
        // Without a device credential: create, join or claim a chain (rate limited).
        app.MapPost("/api/chains", CreateAsync).RequireRateLimiting(SecretsRateLimit);
        app.MapPost("/api/chains/join", JoinAsync).RequireRateLimiting(SecretsRateLimit);
        app.MapPost("/api/chains/claim", ClaimAsync).RequireRateLimiting(SecretsRateLimit);

        // With a device credential: the caller's own chain.
        app.MapGet("/api/chain", DescribeAsync);
        app.MapDelete("/api/chain/devices/{deviceId}", RemoveDeviceAsync);
        app.MapPost("/api/chain/replace", ReplaceAsync);
        app.MapDelete("/api/chain", DeleteAsync);
        return app;
    }

    /// <summary>POST /api/chains: creates a chain with the calling device in it.</summary>
    private static async Task<IResult> CreateAsync(
        HttpContext http, ChainService chains, IOptions<JsonOptions> jsonOptions, CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var (request, error) = await DeviceAuth.ReadJsonAsync<CreateChainRequest>(http, jsonOptions, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        try
        {
            var access = await chains.CreateAsync(request!.DeviceName, cancellationToken);
            DeviceAuth.NoStore(http.Response);
            return Results.Json(access, statusCode: StatusCodes.Status201Created);
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    /// <summary>POST /api/chains/join: adds the calling device to the chain whose code it sends.</summary>
    private static async Task<IResult> JoinAsync(
        HttpContext http, ChainService chains, IOptions<JsonOptions> jsonOptions, CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var (request, error) = await DeviceAuth.ReadJsonAsync<JoinChainRequest>(http, jsonOptions, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        try
        {
            var access = await chains.JoinAsync(request!.Secret, request.DeviceName, cancellationToken);
            if (access is null)
            {
                return ApiResults.Error(StatusCodes.Status401Unauthorized, "that code doesn't match any sync chain");
            }
            DeviceAuth.NoStore(http.Response);
            return Results.Json(access);
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    /// <summary>
    /// POST /api/chains/claim: turns the library synced with the old shared SYNC_TOKEN (sent as a
    /// bearer token) into a sync chain with a code. Works once; the token is no longer used after that.
    /// </summary>
    private static async Task<IResult> ClaimAsync(
        HttpContext http,
        ChainService chains,
        IOptions<ApiOptions> apiOptions,
        IOptions<JsonOptions> jsonOptions,
        CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var token = apiOptions.Value.SyncToken;
        if (token.Length == 0)
        {
            return ApiResults.Error(StatusCodes.Status404NotFound, "there's no library from a sync token to claim");
        }
        var given = DeviceAuth.BearerToken(http.Request) ?? "";
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(given), Encoding.UTF8.GetBytes(token)))
        {
            return ApiResults.Error(StatusCodes.Status401Unauthorized, "invalid or missing sync token");
        }
        var (request, error) = await DeviceAuth.ReadJsonAsync<CreateChainRequest>(http, jsonOptions, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        try
        {
            var access = await chains.ClaimLegacyAsync(request!.DeviceName, cancellationToken);
            if (access is null)
            {
                return ApiResults.Error(
                    StatusCodes.Status409Conflict,
                    "the library from the sync token was already turned into a sync chain; join it with its code");
            }
            DeviceAuth.NoStore(http.Response);
            return Results.Json(access);
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    /// <summary>GET /api/chain: the caller's chain and its devices.</summary>
    private static async Task<IResult> DescribeAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        DeviceAuth.NoStore(http.Response);
        return Results.Json(await chains.DescribeAsync(device!, cancellationToken));
    }

    /// <summary>DELETE /api/chain/devices/{deviceId}: removes a device; the caller's own ID leaves the chain.</summary>
    private static async Task<IResult> RemoveDeviceAsync(
        string deviceId, HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        return await chains.RemoveDeviceAsync(device!, deviceId, cancellationToken)
            ? Results.NoContent()
            : ApiResults.Error(StatusCodes.Status404NotFound, "that device isn't in this sync chain");
    }

    /// <summary>POST /api/chain/replace: a new chain code; every other device is removed.</summary>
    private static async Task<IResult> ReplaceAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        var secret = await chains.ReplaceSecretAsync(device!, cancellationToken);
        DeviceAuth.NoStore(http.Response);
        return Results.Json(secret);
    }

    /// <summary>DELETE /api/chain: deletes the caller's chain, its devices and all its playlists and videos.</summary>
    private static async Task<IResult> DeleteAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        await chains.DeleteAsync(device!, cancellationToken);
        return Results.NoContent();
    }
}
