namespace YtPlaylist.Api;

/// <summary>Error body the web app reads: <c>{ "error": "…" }</c>.</summary>
public sealed record ApiError(string Error);
