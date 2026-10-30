using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.YouTube;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>
/// Reads video titles through YouTube's public oEmbed endpoint, which needs no API
/// key. The browser can't call it directly (no CORS headers), so the API proxies it.
/// </summary>
public sealed class OEmbedClient(HttpClient http, IOptions<YouTubeOptions> options) : IVideoMetadataSource
{
    public async Task<VideoMetadata> GetVideoAsync(string youTubeId, CancellationToken cancellationToken)
    {
        if (!YouTubeIds.IsVideoId(youTubeId))
        {
            throw new DomainValidationException("invalid youtube id");
        }

        var watchUrl = Uri.EscapeDataString($"https://www.youtube.com/watch?v={youTubeId}");
        var url = new Uri($"{options.Value.OEmbedEndpoint}?url={watchUrl}&format=json");
        using var response = await http.GetAsync(url, cancellationToken);
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized
            or HttpStatusCode.Forbidden or HttpStatusCode.BadRequest)
        {
            throw new YouTubeNotFoundException("video not found or not embeddable");
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new YouTubeUnavailableException($"oembed http {(int)response.StatusCode}");
        }

        var body = await response.Content.ReadFromJsonAsync<OEmbedResponse>(cancellationToken)
            ?? throw new YouTubeUnavailableException("oembed returned an empty body");
        var thumbnail = string.IsNullOrEmpty(body.ThumbnailUrl)
            ? $"https://i.ytimg.com/vi/{youTubeId}/hqdefault.jpg"
            : body.ThumbnailUrl;
        return new VideoMetadata(youTubeId, body.Title ?? "", body.AuthorName ?? "", thumbnail);
    }

    private sealed record OEmbedResponse(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("author_name")] string? AuthorName,
        [property: JsonPropertyName("thumbnail_url")] string? ThumbnailUrl);
}
