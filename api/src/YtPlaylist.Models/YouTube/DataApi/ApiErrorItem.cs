namespace YtPlaylist.Models.YouTube.DataApi;

/// <summary>One reason given with a YouTube Data API error.</summary>
public sealed record ApiErrorItem(string? Reason);
