namespace YtPlaylist.Api;

/// <summary>
/// Refuses sync, chain and report requests from an app older than the oldest version this API
/// supports, with 426 Upgrade Required, so a tab left open asks to reload instead of syncing.
/// The web app sends its version in <see cref="Header"/>; an app without it counts as 0.0.0.
/// </summary>
public static class AppVersionGate
{
    public const string Header = "X-App-Version";

    /// <summary>
    /// The oldest app version this API works with. Raise it only with a change older apps can't
    /// handle; MIN_APP_VERSION overrides it.
    /// </summary>
    public const string MinimumAppVersion = "0.0.0";

    private static readonly string[] GatedPaths = ["/api/sync", "/api/chain", "/api/chains", "/api/pairing", "/api/reports"];

    public static string Minimum(IConfiguration config) => config["MIN_APP_VERSION"] is { Length: > 0 } min ? min : MinimumAppVersion;

    /// <summary>True when <paramref name="appVersion"/> (missing or unreadable counts as 0.0.0) is below <paramref name="minimum"/>.</summary>
    public static bool IsTooOld(string? appVersion, string minimum) =>
        Parse(appVersion) < Parse(minimum);

    public static WebApplication UseAppVersionGate(this WebApplication app)
    {
        var minimum = Minimum(app.Configuration);
        app.Use(async (http, next) =>
        {
            var path = http.Request.Path;
            var gated = GatedPaths.Any(p => path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase));
            if (gated && !HttpMethods.IsOptions(http.Request.Method) && IsTooOld(http.Request.Headers[Header], minimum))
            {
                await ApiResults.Error(
                    StatusCodes.Status426UpgradeRequired,
                    "this version of the app is out of date: reload the page to keep syncing").ExecuteAsync(http);
                return;
            }
            await next(http);
        });
        return app;
    }

    private static Version Parse(string? version) =>
        Version.TryParse(version, out var parsed) ? parsed : new Version(0, 0, 0);
}
