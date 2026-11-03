namespace YtPlaylist.Application.Chains;

/// <summary>
/// The device was removed from its chain (or the chain's code was replaced or recovered)
/// after its request was authenticated; nothing it sent was written.
/// </summary>
public sealed class DeviceRemovedException : Exception
{
    public DeviceRemovedException()
        : base("This device was removed from its sync chain.")
    {
    }

    public DeviceRemovedException(string message)
        : base(message)
    {
    }

    public DeviceRemovedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
