using YtPlaylist.Application.YouTube;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Api.Endpoints;

public static class YouTubeEndpoints
{
    /// <summary>
    /// GET /api/oembed?id=… (video title and channel) and
    /// GET /api/playlist?id=… (a public playlist's title and videos).
    /// </summary>
    public static IEndpointRouteBuilder MapYouTubeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/oembed", GetVideoAsync);
        app.MapGet("/api/playlist", GetPlaylistAsync);
        return app;
    }

    private static async Task<IResult> GetVideoAsync(
        string? id,
        HttpContext http,
        IVideoMetadataSource source,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var video = await source.GetVideoAsync(id ?? "", cancellationToken);
            http.Response.Headers.CacheControl = "public, max-age=86400";
            return Results.Json(video);
        }
        catch (DomainValidationException ex)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, ex.Message);
        }
        catch (YouTubeNotFoundException ex)
        {
            return ApiResults.Error(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            loggerFactory.CreateLogger("YouTube").LogWarning(ex, "oEmbed lookup for {VideoId} failed", id);
            return ApiResults.Error(StatusCodes.Status502BadGateway, "could not reach YouTube");
        }
    }

    private static async Task<IResult> GetPlaylistAsync(
        string? id,
        HttpContext http,
        IYouTubePlaylistSource source,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var playlist = await source.GetPlaylistAsync(id ?? "", cancellationToken);
            http.Response.Headers.CacheControl = "public, max-age=600";
            return Results.Json(playlist);
        }
        catch (DomainValidationException)
        {
            return ApiResults.Error(StatusCodes.Status400BadRequest, "that isn't a valid YouTube playlist id");
        }
        catch (Exception ex) when (ex is YouTubeNotFoundException or PlaylistNotSupportedException)
        {
            return ApiResults.Error(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            loggerFactory.CreateLogger("YouTube").LogWarning(ex, "Playlist {PlaylistId} could not be read", id);
            return ApiResults.Error(StatusCodes.Status502BadGateway, "could not read the playlist from YouTube");
        }
    }
}
