using System.Data.Common;
using Npgsql;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>
/// Accepts the URL form Neon and other hosts hand out
/// (<c>postgresql://user:password@host/db?sslmode=require</c>) as well as a regular
/// Npgsql connection string (<c>Host=…;Database=…</c>).
/// </summary>
/// <remarks>
/// GSS (Kerberos) encryption is turned off unless the value asks for it. Npgsql tries it
/// first by default, which needs the native <c>libgssapi_krb5</c> library that the
/// runtime image doesn't ship, and Neon doesn't offer it. Connections still use TLS as
/// set by <c>sslmode</c>; with GSS off, a server that requires GSS refuses the connection.
/// </remarks>
public static class PostgresConnectionString
{
    public static string From(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        value = value.Trim();
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            var plain = new NpgsqlConnectionStringBuilder(value);
            if (!SetsGssEncryptionMode(value))
            {
                plain.GssEncryptionMode = GssEncryptionMode.Disable;
            }
            return plain.ConnectionString;
        }

        var uri = new Uri(value);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            GssEncryptionMode = GssEncryptionMode.Disable,
        };
        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo[0].Length > 0)
        {
            builder.Username = Uri.UnescapeDataString(userInfo[0]);
        }
        if (userInfo.Length == 2)
        {
            builder.Password = Uri.UnescapeDataString(userInfo[1]);
        }

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(parts[0]).ToUpperInvariant();
            var setting = parts.Length == 2 ? Uri.UnescapeDataString(parts[1]).ToUpperInvariant() : "";
            switch (key)
            {
                case "SSLMODE":
                    builder.SslMode = setting switch
                    {
                        "DISABLE" => SslMode.Disable,
                        "ALLOW" => SslMode.Allow,
                        "PREFER" => SslMode.Prefer,
                        "REQUIRE" => SslMode.Require,
                        "VERIFY-CA" => SslMode.VerifyCA,
                        "VERIFY-FULL" => SslMode.VerifyFull,
                        _ => throw new FormatException($"Unknown sslmode '{setting}'."),
                    };
                    break;
                case "GSSENCMODE":
                    builder.GssEncryptionMode = setting switch
                    {
                        "DISABLE" => GssEncryptionMode.Disable,
                        "PREFER" => GssEncryptionMode.Prefer,
                        "REQUIRE" => GssEncryptionMode.Require,
                        _ => throw new FormatException($"Unknown gssencmode '{setting}'."),
                    };
                    break;
                case "CHANNEL_BINDING":
                    builder.ChannelBinding = setting switch
                    {
                        "DISABLE" => ChannelBinding.Disable,
                        "PREFER" => ChannelBinding.Prefer,
                        "REQUIRE" => ChannelBinding.Require,
                        _ => throw new FormatException($"Unknown channel_binding '{setting}'."),
                    };
                    break;
                default:
                    break;
            }
        }
        return builder.ConnectionString;
    }

    /// <summary>Whether a <c>Key=value</c> connection string sets the GSS encryption mode itself.</summary>
    private static bool SetsGssEncryptionMode(string connectionString)
    {
        var keys = new DbConnectionStringBuilder { ConnectionString = connectionString }.Keys;
        return keys.Cast<string>()
            .Select(key => key.Replace(" ", "", StringComparison.Ordinal))
            .Any(key => key.Equals("GssEncryptionMode", StringComparison.OrdinalIgnoreCase)
                || key.Equals("GssEncMode", StringComparison.OrdinalIgnoreCase));
    }
}
