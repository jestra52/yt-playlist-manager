using YtPlaylist.Models.Api;

namespace YtPlaylist.Api;

public static class ApiResults
{
    public static IResult Error(int statusCode, string message) => Results.Json(new ApiError(message), statusCode: statusCode);
}
