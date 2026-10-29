namespace YtPlaylist.Api;

/// <summary>Error body the web app reads: <c>{ "error": "…" }</c>.</summary>
public sealed record ApiError(string Error);

public static class ApiResults
{
    public static IResult Error(int statusCode, string message) => Results.Json(new ApiError(message), statusCode: statusCode);
}
