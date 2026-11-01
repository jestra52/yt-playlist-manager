namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>A YouTube Data API error.</summary>
public sealed record ApiError(int Code, string? Message, IReadOnlyList<ApiErrorItem>? Errors);
