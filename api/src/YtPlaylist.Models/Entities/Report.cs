namespace YtPlaylist.Models.Entities;

/// <summary>A backup of a playlist, made by a device. It never changes after it's saved.</summary>
public sealed class Report
{
    /// <summary>Set by the device, so sending it again doesn't make a second one.</summary>
    public required string Id { get; set; }
    public required string ChainId { get; set; }
    public required string PlaylistId { get; set; }

    /// <summary>The playlist's name when the backup was made.</summary>
    public string PlaylistName { get; set; } = "";

    /// <summary>Why it was made, e.g. "added" or "download".</summary>
    public string Reason { get; set; } = "";
    public int VideoCount { get; set; }

    /// <summary>The JSON report as the app wrote it. The server doesn't read it.</summary>
    public required string Content { get; set; }

    /// <summary>Milliseconds since the Unix epoch, set by the device.</summary>
    public long CreatedAt { get; set; }
}
