namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Secrets for sync chains, read from settings.</summary>
public sealed class ChainSecurityOptions
{
    /// <summary>A pepper shorter than this is treated as missing.</summary>
    public const int MinPepperLength = 32;

    /// <summary>
    /// SYNC_PEPPER: the key for hashing chain codes and device credentials. Keep it out of the
    /// database (e.g. in Render's environment settings). Changing it makes every chain code and
    /// device credential stop working.
    /// </summary>
    public string Pepper { get; set; } = "";
}
