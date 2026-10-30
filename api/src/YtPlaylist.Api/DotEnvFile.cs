using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Configuration.Memory;

namespace YtPlaylist.Api;

/// <summary>
/// Reads a local, git-ignored <c>.env</c> file (<c>KEY=value</c> lines) so development settings and
/// secrets such as YOUTUBE_API_KEY stay out of the repository. See <c>api/.env.example</c>.
/// </summary>
public static class DotEnvFile
{
    public const string FileName = ".env";

    /// <summary>
    /// Returns the nearest <c>.env</c> in <paramref name="startDirectory"/> or one of its parents,
    /// stopping at the repository root (the folder that holds <c>.git</c>).
    /// </summary>
    public static string? Find(string startDirectory)
    {
        for (var directory = new DirectoryInfo(startDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, FileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }
            if (Directory.Exists(Path.Combine(directory.FullName, ".git")))
            {
                return null;
            }
        }
        return null;
    }

    /// <summary>
    /// Parses <c>KEY=value</c> lines. Blank lines and lines starting with <c>#</c> are skipped, an
    /// optional <c>export </c> prefix is allowed, and matching single or double quotes around a value
    /// are removed. Everything after the first <c>=</c> is the value, so URLs with query strings work.
    /// </summary>
    public static Dictionary<string, string?> Parse(IEnumerable<string> lines)
    {
        ArgumentNullException.ThrowIfNull(lines);

        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var number = 0;
        foreach (var raw in lines)
        {
            number++;
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }
            if (line.StartsWith("export ", StringComparison.Ordinal))
            {
                line = line["export ".Length..].TrimStart();
            }

            var equals = line.IndexOf('=');
            if (equals <= 0)
            {
                throw new FormatException($"{FileName} line {number} is not KEY=value.");
            }

            var value = line[(equals + 1)..].Trim();
            if (value.Length >= 2 && value[0] is '"' or '\'' && value[^1] == value[0])
            {
                value = value[1..^1];
            }
            values[line[..equals].Trim()] = value;
        }
        return values;
    }

    /// <summary>
    /// Adds the file's values just below the process environment variables, so a variable set in the
    /// shell or by the host still wins over the file.
    /// </summary>
    public static IConfigurationBuilder AddDotEnvFile(this IConfigurationBuilder configuration, string path)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var source = new MemoryConfigurationSource { InitialData = Parse(File.ReadLines(path)) };
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
