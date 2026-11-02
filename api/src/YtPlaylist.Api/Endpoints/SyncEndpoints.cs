using System.Globalization;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Sync;
using JsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace YtPlaylist.Api.Endpoints;

public static class SyncEndpoints
{
    /// <summary>
    /// POST /api/sync: push local changes, pull server changes newer than <c>since</c>, both in
    /// the sync chain of the device whose credential is sent as a bearer token.
    /// </summary>
    public static IEndpointRouteBuilder MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/sync", SyncAsync);
        return app;
    }

    private static async Task<IResult> SyncAsync(
        HttpContext http,
        SyncService sync,
        ChainService chains,
        IOptions<JsonOptions> jsonOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!sync.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var (device, authError) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (authError is not null)
        {
            return authError;
        }
        var (request, bodyError) = await DeviceAuth.ReadJsonAsync<SyncRequest>(http, jsonOptions, cancellationToken);
        if (bodyError is not null)
        {
            return bodyError;
        }

        int? limit = int.TryParse(http.Request.Query["limit"].ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var l)
            ? l
            : null;
        try
        {
            return Results.Json(await sync.SyncAsync(device!.ChainId, request!, limit, cancellationToken));
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
}
