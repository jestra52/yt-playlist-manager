namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>The body of a YouTube Data API error.</summary>
internal sealed record ApiErrorResponse(ApiError? Error);
