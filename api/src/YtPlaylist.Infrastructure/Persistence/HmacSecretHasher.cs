using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using YtPlaylist.Application.Chains;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>
/// Random 256-bit secrets, and HMAC-SHA256 hashes keyed with the server's pepper (SYNC_PEPPER).
/// The pepper lives outside the database, so a copy of the database alone can't be used to
/// check guesses of a chain code or a device credential. A slow password hash isn't needed:
/// the secrets are random and 256 bits long, so they can't be guessed.
/// </summary>
public sealed class HmacSecretHasher(IOptions<ChainSecurityOptions> options) : ISecretHasher
{
    private const int SecretBytes = 32;

    public bool IsConfigured => options.Value.Pepper.Length >= ChainSecurityOptions.MinPepperLength;

    public string NewSecret() => Base64Url(RandomNumberGenerator.GetBytes(SecretBytes));

    public string NewRecoveryCode() => RandomNumberGenerator.GetString(RecoveryCode.Alphabet, RecoveryCode.Length);

    public string Hash(string secret)
    {
        ArgumentNullException.ThrowIfNull(secret);
        if (!this.IsConfigured)
        {
            throw new InvalidOperationException("SYNC_PEPPER is not set.");
        }
        var key = Encoding.UTF8.GetBytes(options.Value.Pepper);
        return Base64Url(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(secret)));
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
