namespace YtPlaylist.Tests;

using Npgsql;
using YtPlaylist.Infrastructure.Persistence;

public sealed class PostgresConnectionStringTests
{
    [Fact]
    public void ConvertsNeonStyleUrls()
    {
        var result = new NpgsqlConnectionStringBuilder(PostgresConnectionString.From(
            "postgresql://neondb_owner:p%40ss%3Aword@ep-cool-1.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"));

        Assert.Equal("ep-cool-1.us-east-2.aws.neon.tech", result.Host);
        Assert.Equal(5432, result.Port);
        Assert.Equal("neondb", result.Database);
        Assert.Equal("neondb_owner", result.Username);
        Assert.Equal("p@ss:word", result.Password);
        Assert.Equal(SslMode.Require, result.SslMode);
        Assert.Equal(ChannelBinding.Require, result.ChannelBinding);
    }

    [Fact]
    public void KeepsPortsAndPassesConnectionStringsThrough()
    {
        var result = new NpgsqlConnectionStringBuilder(PostgresConnectionString.From("postgres://u:p@localhost:6543/app"));
        Assert.Equal(6543, result.Port);
        Assert.Equal("app", result.Database);

        const string plain = "Host=localhost;Database=app;Username=u;Password=p";
        Assert.Equal(plain, PostgresConnectionString.From(plain));
    }
}
