using Microsoft.Extensions.Configuration;
using YtPlaylist.Api;

namespace YtPlaylist.Tests;

public sealed class LocalSettingsFileTests : IDisposable
{
    private readonly string root = Directory.CreateTempSubdirectory("local-settings-").FullName;

    public void Dispose() => Directory.Delete(this.root, recursive: true);

    [Fact]
    public void ReadsTheFileAndEnvironmentVariablesWin()
    {
        var shellKey = $"LOCAL_SETTINGS_TEST_{Guid.NewGuid():N}";
        File.WriteAllText(
            Path.Combine(this.root, LocalSettingsFile.FileName),
            $$"""
            // Comments are allowed, like in appsettings.Local.example.json.
            { "{{shellKey}}": "from-file", "FILE_ONLY": "from-file" }
            """);
        Environment.SetEnvironmentVariable(shellKey, "from-shell");
        try
        {
            using var configuration = (ConfigurationRoot)new ConfigurationBuilder()
                .AddEnvironmentVariables()
                .AddLocalSettingsFile(this.root)
                .Build();

            Assert.Equal("from-shell", configuration[shellKey]);
            Assert.Equal("from-file", configuration["FILE_ONLY"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(shellKey, null);
        }
    }

    [Fact]
    public void AMissingFileIsFine()
    {
        using var configuration = (ConfigurationRoot)new ConfigurationBuilder()
            .AddLocalSettingsFile(this.root)
            .Build();

        Assert.Null(configuration["DATABASE_URL"]);
    }

    [Fact]
    public void TheExampleFileListsEveryKeyTheApiReads()
    {
        var example = Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "..", "src", "YtPlaylist.Api", "appsettings.Local.example.json");
        File.Copy(example, Path.Combine(this.root, LocalSettingsFile.FileName));

        using var configuration = (ConfigurationRoot)new ConfigurationBuilder()
            .AddLocalSettingsFile(this.root)
            .Build();

        foreach (var key in new[] { "DATABASE_URL", "SYNC_TOKEN", "YOUTUBE_API_KEY", "ALLOWED_ORIGIN" })
        {
            Assert.NotNull(configuration[key]);
        }
    }
}
