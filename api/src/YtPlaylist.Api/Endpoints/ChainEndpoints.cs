using System.Globalization;
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

    /// <summary>Stricter rate limit policy for recovering a chain: it works as the lockout after repeated failures.</summary>
    public const string RecoveryRateLimit = "chain-recovery";

    /// <summary>Rate limit policy for entering a pairing code.</summary>
    public const string PairingRateLimit = "chain-pairing";

    /// <summary>Rate limit policy for a new device asking whether its pairing was approved (it asks every few seconds).</summary>
    public const string PairingStatusRateLimit = "chain-pairing-status";

    public static IEndpointRouteBuilder MapChainEndpoints(this IEndpointRouteBuilder app)
    {
        // Without a device credential: create, join, claim or recover a chain (rate limited).
        // Wrong codes also lock the client out for a while (IAttemptLockout).
        app.MapPost("/api/chains", CreateAsync).RequireRateLimiting(SecretsRateLimit);
        app.MapPost("/api/chains/join", JoinAsync).RequireRateLimiting(SecretsRateLimit);
        app.MapPost("/api/chains/claim", ClaimAsync).RequireRateLimiting(SecretsRateLimit);
        app.MapPost("/api/chains/recover", RecoverAsync).RequireRateLimiting(RecoveryRateLimit);
        app.MapPost("/api/chains/pair", PairAsync).RequireRateLimiting(PairingRateLimit);

        // With the request token from /api/chains/pair. Outside /api/chains, so that waiting
        // for approval doesn't use up the limit shared by everyone there.
        app.MapPost("/api/pairing/status", PairingStatusAsync).RequireRateLimiting(PairingStatusRateLimit);

        // With a device credential: the caller's own chain.
        app.MapGet("/api/chain", DescribeAsync);
        app.MapGet("/api/chain/events", ListEventsAsync);
        app.MapDelete("/api/chain/devices/{deviceId}", RemoveDeviceAsync);
        app.MapPost("/api/chain/replace", ReplaceAsync);
        app.MapPost("/api/chain/recovery-codes", RenewRecoveryCodesAsync);
        app.MapDelete("/api/chain", DeleteAsync);
        app.MapPost("/api/chain/pairing", StartPairingAsync);
        app.MapGet("/api/chain/pairing", DescribePairingAsync);
        app.MapPost("/api/chain/pairing/approve", ApprovePairingAsync);
        app.MapPost("/api/chain/pairing/deny", DenyPairingAsync);
        app.MapDelete("/api/chain/pairing", CancelPairingAsync);
        return app;
    }

    /// <summary>
    /// POST /api/chains/pair: a new device entered a pairing code; it gets a request token to ask
    /// with whether the device that created the code approved it. The code itself is never logged.
    /// </summary>
    private static async Task<IResult> PairAsync(
        HttpContext http,
        ChainService chains,
        IAttemptLockout lockout,
        IOptions<JsonOptions> jsonOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        if (LockedOut(http, lockout) is { } locked)
        {
            return locked;
        }
        var (request, error) = await DeviceAuth.ReadJsonAsync<PairDeviceRequest>(http, jsonOptions, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        try
        {
            var ticket = await chains.RequestPairingAsync(request!.Code, request.DeviceName, cancellationToken);
            if (ticket is null)
            {
                Failed(http, lockout, loggerFactory);
                loggerFactory.CreateLogger("Chains").PairingFailed();
                return ApiResults.Error(
                    StatusCodes.Status401Unauthorized,
                    "that pairing code doesn't match, has expired or was already used; ask for a new one");
            }
            DeviceAuth.NoStore(http.Response);
            return Results.Json(ticket, statusCode: StatusCodes.Status202Accepted);
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    /// <summary>
    /// POST /api/pairing/status: whether the pairing request (its token sent as a bearer token)
    /// was approved; the first answer after approval carries the new device's credential.
    /// </summary>
    private static async Task<IResult> PairingStatusAsync(
        HttpContext http, ChainService chains, IAttemptLockout lockout, ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        if (LockedOut(http, lockout) is { } locked)
        {
            return locked;
        }
        var result = await chains.CollectPairingAsync(DeviceAuth.BearerToken(http.Request) ?? "", cancellationToken);
        if (result is null)
        {
            Failed(http, lockout, loggerFactory);
            return ApiResults.Error(StatusCodes.Status401Unauthorized, "unknown pairing request");
        }
        DeviceAuth.NoStore(http.Response);
        return Results.Json(result);
    }

    /// <summary>POST /api/chain/pairing: a new pairing code for the caller's chain, replacing the caller's previous one.</summary>
    private static async Task<IResult> StartPairingAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        var code = await chains.StartPairingAsync(device!, cancellationToken);
        if (code is null)
        {
            return ApiResults.Error(
                StatusCodes.Status423Locked,
                "adding devices with a pairing code is paused for this sync chain after repeated refused attempts; try again later or use the chain code");
        }
        DeviceAuth.NoStore(http.Response);
        return Results.Json(code, statusCode: StatusCodes.Status201Created);
    }

    /// <summary>GET /api/chain/pairing: where the caller's pairing code stands, including which device entered it.</summary>
    private static async Task<IResult> DescribePairingAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        var pairing = await chains.DescribePairingAsync(device!, cancellationToken);
        DeviceAuth.NoStore(http.Response);
        return pairing is null
            ? ApiResults.Error(StatusCodes.Status404NotFound, "this device has no pairing code")
            : Results.Json(pairing);
    }

    /// <summary>POST /api/chain/pairing/approve: lets the device that entered the caller's code join.</summary>
    private static async Task<IResult> ApprovePairingAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        return await chains.ApprovePairingAsync(device!, cancellationToken) ? Results.NoContent() : NoPairingRequest();
    }

    /// <summary>POST /api/chain/pairing/deny: refuses the device that entered the caller's code.</summary>
    private static async Task<IResult> DenyPairingAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        return await chains.DenyPairingAsync(device!, cancellationToken) ? Results.NoContent() : NoPairingRequest();
    }

    /// <summary>DELETE /api/chain/pairing: cancels the caller's pairing code.</summary>
    private static async Task<IResult> CancelPairingAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        await chains.CancelPairingAsync(device!, cancellationToken);
        return Results.NoContent();
    }

    private static IResult NoPairingRequest() => ApiResults.Error(
        StatusCodes.Status409Conflict, "no device is waiting to join with this device's pairing code (it may have expired)");

    /// <summary>The client's key for the lockout: its address, from X-Forwarded-For behind the proxies.</summary>
    private static string ClientKey(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <summary>The 429 to answer with when the client is locked out after too many wrong codes, or null.</summary>
    private static IResult? LockedOut(HttpContext http, IAttemptLockout lockout)
    {
        if (lockout.LockedUntil(ClientKey(http)) is not { } until)
        {
            return null;
        }
        var seconds = Math.Max(1, (until - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) / 1000);
        http.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        return ApiResults.Error(
            StatusCodes.Status429TooManyRequests, "too many wrong codes from this network; wait a few minutes and try again");
    }

    /// <summary>Counts a wrong code against the client, and logs it when that locks the client out.</summary>
    private static void Failed(HttpContext http, IAttemptLockout lockout, ILoggerFactory loggerFactory)
    {
        var key = ClientKey(http);
        lockout.RecordFailure(key);
        if (lockout.LockedUntil(key) is not null)
        {
            loggerFactory.CreateLogger("Chains").JoinLockedOut();
        }
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
        HttpContext http,
        ChainService chains,
        IAttemptLockout lockout,
        IOptions<JsonOptions> jsonOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        if (LockedOut(http, lockout) is { } locked)
        {
            return locked;
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
                Failed(http, lockout, loggerFactory);
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

    /// <summary>
    /// POST /api/chains/recover: recovers the chain with the recovery code sent, from any device.
    /// The chain gets a new code and new recovery codes, every old device is removed and the
    /// calling device joins. The code itself is never logged.
    /// </summary>
    private static async Task<IResult> RecoverAsync(
        HttpContext http,
        ChainService chains,
        IAttemptLockout lockout,
        IOptions<JsonOptions> jsonOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!chains.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        if (LockedOut(http, lockout) is { } locked)
        {
            return locked;
        }
        var (request, error) = await DeviceAuth.ReadJsonAsync<RecoverChainRequest>(http, jsonOptions, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        try
        {
            var access = await chains.RecoverAsync(request!.RecoveryCode, request.DeviceName, cancellationToken);
            if (access is null)
            {
                Failed(http, lockout, loggerFactory);
                loggerFactory.CreateLogger("Chains").RecoveryFailed();
                return ApiResults.Error(
                    StatusCodes.Status401Unauthorized,
                    "that recovery code doesn't match any sync chain, or it was already used");
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

    /// <summary>GET /api/chain/events?limit=: the caller's chain's audit log, newest first; never includes a secret.</summary>
    private static async Task<IResult> ListEventsAsync(HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        int? limit = int.TryParse(http.Request.Query["limit"].ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var l)
            ? l
            : null;
        DeviceAuth.NoStore(http.Response);
        return Results.Json(await chains.ListEventsAsync(device!, limit, cancellationToken));
    }

    /// <summary>POST /api/chain/recovery-codes: new recovery codes, shown once; the old ones stop working.</summary>
    private static async Task<IResult> RenewRecoveryCodesAsync(
        HttpContext http, ChainService chains, CancellationToken cancellationToken)
    {
        var (device, error) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (error is not null)
        {
            return error;
        }
        var codes = await chains.RenewRecoveryCodesAsync(device!, cancellationToken);
        DeviceAuth.NoStore(http.Response);
        return Results.Json(codes);
    }

    /// <summary>POST /api/chain/replace: a new chain code and recovery codes; every other device is removed.</summary>
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
