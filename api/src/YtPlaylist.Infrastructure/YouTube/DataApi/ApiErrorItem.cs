namespace YtPlaylist.Infrastructure.YouTube;

/// <summary>One reason given with a YouTube Data API error.</summary>
internal sealed record ApiErrorItem(string? Reason);
