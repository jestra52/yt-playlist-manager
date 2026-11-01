namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>The body of a YouTube Data API error.</summary>
public sealed record ApiErrorResponse(ApiError? Error);
