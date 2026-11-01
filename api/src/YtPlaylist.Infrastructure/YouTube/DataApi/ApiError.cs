namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>A YouTube Data API error.</summary>
internal sealed record ApiError(int Code, string? Message, IReadOnlyList<ApiErrorItem>? Errors);
