using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Reports;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Reports;
using JsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace YtPlaylist.Api.Endpoints;

public static class ReportEndpoints
{
    /// <summary>Requests per device: backups are saved on a few actions, and read when someone opens them.</summary>
    public const string RateLimit = "reports";

    /// <summary>A JSON string can take several bytes per character of the report.</summary>
    private const long MaxBodyBytes = SyncLimits.MaxReportLength * 2L;

    /// <summary>
    /// POST /api/reports saves a playlist backup, GET /api/reports?playlistId=… lists them without
    /// their content, and GET /api/reports/{id} returns one, all in the device's sync chain.
    /// </summary>
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/reports", SaveAsync)
            .RequireRateLimiting(RateLimit)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));
        app.MapGet("/api/reports", ListAsync).RequireRateLimiting(RateLimit);
        app.MapGet("/api/reports/{id}", GetAsync).RequireRateLimiting(RateLimit);
        return app;
    }

    private static async Task<IResult> SaveAsync(
        HttpContext http,
        ReportService reports,
        ChainService chains,
        IOptions<JsonOptions> jsonOptions,
        CancellationToken cancellationToken)
    {
        if (!reports.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var (device, authError) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (authError is not null)
        {
            return authError;
        }
        var (request, bodyError) = await DeviceAuth.ReadJsonAsync<SaveReportRequest>(http, jsonOptions, cancellationToken);
        if (bodyError is not null)
        {
            return bodyError;
        }
        try
        {
            await reports.SaveAsync(device!, request!, cancellationToken);
            return Results.NoContent();
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    private static async Task<IResult> ListAsync(
        HttpContext http, string? playlistId, ReportService reports, ChainService chains, CancellationToken cancellationToken)
    {
        if (!reports.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var (device, authError) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (authError is not null)
        {
            return authError;
        }
        DeviceAuth.NoStore(http.Response);
        return Results.Json(await reports.ListAsync(device!, playlistId, cancellationToken));
    }

    private static async Task<IResult> GetAsync(
        HttpContext http, string id, ReportService reports, ChainService chains, CancellationToken cancellationToken)
    {
        if (!reports.IsAvailable)
        {
            return DeviceAuth.NotConfigured();
        }
        var (device, authError) = await DeviceAuth.AuthenticateAsync(http, chains, cancellationToken);
        if (authError is not null)
        {
            return authError;
        }
        var report = await reports.FindAsync(device!, id, cancellationToken);
        if (report is null)
        {
            return ApiResults.Error(StatusCodes.Status404NotFound, "no such report");
        }
        DeviceAuth.NoStore(http.Response);
        return Results.Text(report.Content, "application/json");
    }
}
