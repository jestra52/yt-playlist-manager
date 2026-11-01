using Npgsql;
using YtPlaylist.Infrastructure.Persistence;

namespace YtPlaylist.Tests;

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

        var plain = new NpgsqlConnectionStringBuilder(
            PostgresConnectionString.From("Host=localhost;Database=app;Username=u;Password=p;SSL Mode=Require"));
        Assert.Equal("localhost", plain.Host);
        Assert.Equal("app", plain.Database);
        Assert.Equal("u", plain.Username);
        Assert.Equal("p", plain.Password);
        Assert.Equal(SslMode.Require, plain.SslMode);
    }

    [Theory]
    [InlineData("postgresql://u:p@ep-cool-1.neon.tech/neondb?sslmode=require")]
    [InlineData("Host=localhost;Database=app;Username=u;Password=p")]
    public void TurnsOffGssEncryptionByDefault(string value)
    {
        var result = new NpgsqlConnectionStringBuilder(PostgresConnectionString.From(value));
        Assert.Equal(GssEncryptionMode.Disable, result.GssEncryptionMode);
    }

    [Theory]
    [InlineData("postgresql://u:p@localhost/app?gssencmode=prefer")]
    [InlineData("Host=localhost;Database=app;Gss Encryption Mode=Prefer")]
    public void KeepsGssEncryptionWhenAskedFor(string value)
    {
        var result = new NpgsqlConnectionStringBuilder(PostgresConnectionString.From(value));
        Assert.Equal(GssEncryptionMode.Prefer, result.GssEncryptionMode);
    }
}
