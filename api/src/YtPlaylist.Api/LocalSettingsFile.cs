using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.Extensions.FileProviders;

namespace YtPlaylist.Api;

/// <summary>
/// Reads the git-ignored <c>appsettings.Local.json</c> next to <c>appsettings.json</c>, so local
/// settings and secrets such as YOUTUBE_API_KEY stay out of the repository. Copy
/// <c>appsettings.Local.example.json</c> to start one.
/// </summary>
public static class LocalSettingsFile
{
    public const string FileName = "appsettings.Local.json";

    /// <summary>
    /// Adds the file (optional, reloaded on change) just below the process environment variables,
    /// so a variable set in the shell or by the host still wins over the file.
    /// </summary>
    public static IConfigurationBuilder AddLocalSettingsFile(this IConfigurationBuilder configuration, string directory)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentException.ThrowIfNullOrWhiteSpace(directory);

        var source = new JsonConfigurationSource
        {
            FileProvider = new PhysicalFileProvider(directory),
            Path = FileName,
            Optional = true,
            ReloadOnChange = true,
        };
        var sources = configuration.Sources;
        var index = sources.Count;
        for (var i = 0; i < sources.Count; i++)
        {
            if (sources[i] is EnvironmentVariablesConfigurationSource { Prefix: null or "" })
            {
                index = i;
                break;
            }
        }
        sources.Insert(index, source);
        return configuration;
    }
}
