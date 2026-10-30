using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.Sync;
using YtPlaylist.Domain.Common;
using JsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace YtPlaylist.Api.Endpoints;

public static class SyncEndpoints
{
    /// <summary>POST /api/sync: push local changes, pull server changes newer than <c>since</c>.</summary>
    public static IEndpointRouteBuilder MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/sync", SyncAsync);
        return app;
    }

    private static async Task<IResult> SyncAsync(
        HttpContext http,
        SyncService sync,
        IOptions<ApiOptions> apiOptions,
        IOptions<JsonOptions> jsonOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var token = apiOptions.Value.SyncToken;
        if (!sync.IsAvailable || token.Length == 0)
        {
            return ApiResults.Error(
                StatusCodes.Status503ServiceUnavailable,
                "sync is not configured on the server (set DATABASE_URL and SYNC_TOKEN)");
        }
        if (!IsAuthorized(http.Request, token))
        {
            return ApiResults.Error(StatusCodes.Status401Unauthorized, "invalid or missing sync token");
        }

        SyncRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<SyncRequest>(
                http.Request.Body, jsonOptions.Value.SerializerOptions, cancellationToken);
        }
        catch (JsonException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, $"invalid JSON body: {ex.Message}");
        }
        if (request is null)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, "invalid JSON body: empty");
        }

        int? limit = int.TryParse(http.Request.Query["limit"].ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var l)
            ? l
            : null;
        try
        {
            return Results.Json(await sync.SyncAsync(request, limit, cancellationToken));
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            loggerFactory.CreateLogger("Sync").SyncFailed(ex);
            return ApiResults.Error(StatusCodes.Status502BadGateway, "could not sync with the cloud database");
        }
    }

    private static bool IsAuthorized(HttpRequest request, string token)
    {
        const string scheme = "Bearer ";
        var header = request.Headers.Authorization.ToString();
        if (header.Length <= scheme.Length || !header.StartsWith(scheme, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        var given = Encoding.UTF8.GetBytes(header[scheme.Length..].Trim());
        return CryptographicOperations.FixedTimeEquals(given, Encoding.UTF8.GetBytes(token));
    }
}
