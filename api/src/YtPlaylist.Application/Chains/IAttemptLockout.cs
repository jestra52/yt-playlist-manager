namespace YtPlaylist.Application.Chains;

/// <summary>
/// Counts failed attempts to join a chain (a wrong chain code, pairing code or recovery code)
/// per key, such as the client's IP address, and locks the key out after too many. Kept in
/// memory: there's one API instance. With more than one, this is what a shared store such as
/// Redis would back; the database stays the final check of every code either way.
/// </summary>
public interface IAttemptLockout
{
    /// <summary>When the key is locked out, until when (milliseconds since the Unix epoch); null otherwise.</summary>
    public long? LockedUntil(string key);

    /// <summary>Counts a failed attempt for the key; locks it out once there are too many.</summary>
    public void RecordFailure(string key);
}
