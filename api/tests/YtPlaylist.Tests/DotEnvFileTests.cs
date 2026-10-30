using Microsoft.Extensions.Configuration;
using YtPlaylist.Api;

namespace YtPlaylist.Tests;

public sealed class DotEnvFileTests : IDisposable
{
    private readonly string root = Directory.CreateTempSubdirectory("dotenv-").FullName;

    public void Dispose() => Directory.Delete(this.root, recursive: true);

    [Fact]
    public void ParsesKeyValueLines()
    {
        var values = DotEnvFile.Parse(
        [
            "# comment",
            "",
            "SYNC_TOKEN=dev-token",
            "  YOUTUBE_API_KEY =  abc  ",
            "export ALLOWED_ORIGIN=https://example.com",
            "DATABASE_URL=postgresql://u:p@host/db?sslmode=require&channel_binding=require",
            "QUOTED=\"two words\"",
            "SINGLE='x=y'",
            "EMPTY=",
        ]);

        Assert.Equal("dev-token", values["SYNC_TOKEN"]);
        Assert.Equal("abc", values["YOUTUBE_API_KEY"]);
        Assert.Equal("https://example.com", values["ALLOWED_ORIGIN"]);
        Assert.Equal("postgresql://u:p@host/db?sslmode=require&channel_binding=require", values["DATABASE_URL"]);
        Assert.Equal("two words", values["QUOTED"]);
        Assert.Equal("x=y", values["SINGLE"]);
        Assert.Equal("", values["EMPTY"]);
        Assert.Equal(7, values.Count);
    }

    [Theory]
    [InlineData("NO_EQUALS_SIGN")]
    [InlineData("=secret")]
    public void RejectsLinesWithoutAKeyAndHidesTheirContent(string line)
    {
        var error = Assert.Throws<FormatException>(() => DotEnvFile.Parse(["OK=1", line]));
        Assert.Contains("line 2", error.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(line, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void FindsTheNearestFileUpToTheRepositoryRoot()
    {
        var project = Directory.CreateDirectory(Path.Combine(this.root, "repo", "api", "src", "Project")).FullName;
        Directory.CreateDirectory(Path.Combine(this.root, "repo", ".git"));

        Assert.Null(DotEnvFile.Find(project));

        // Outside the repository: never read.
        File.WriteAllText(Path.Combine(this.root, ".env"), "A=outside");
        Assert.Null(DotEnvFile.Find(project));

        var apiEnv = Path.Combine(this.root, "repo", "api", ".env");
        File.WriteAllText(apiEnv, "A=api");
        Assert.Equal(apiEnv, DotEnvFile.Find(project));
    }

    [Fact]
    public void EnvironmentVariablesWinOverTheFile()
    {
        var shellKey = $"DOTENV_TEST_{Guid.NewGuid():N}";
        var path = Path.Combine(this.root, ".env");
        File.WriteAllLines(path, [$"{shellKey}=from-file", "FILE_ONLY=from-file"]);
        Environment.SetEnvironmentVariable(shellKey, "from-shell");
        try
        {
            var configuration = new ConfigurationBuilder()
                .AddEnvironmentVariables()
                .AddDotEnvFile(path)
                .Build();

            Assert.Equal("from-shell", configuration[shellKey]);
            Assert.Equal("from-file", configuration["FILE_ONLY"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(shellKey, null);
        }
    }
}
