namespace YtPlaylist.Models.Chains;

/// <summary>A device in the device list; never includes its credential.</summary>
/// <param name="Id"></param>
/// <param name="Name"></param>
/// <param name="CreatedAt">When it joined, in milliseconds since the Unix epoch.</param>
/// <param name="LastSeenAt">When it last used the API, in milliseconds since the Unix epoch.</param>
public sealed record DeviceInfo(string Id, string Name, long CreatedAt, long LastSeenAt);
