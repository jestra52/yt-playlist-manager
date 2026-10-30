namespace YtPlaylist.Application.Sync;

using System.Text.Json.Serialization;

// JSON shapes exchanged with the web app (camelCase on the wire). They match
// the rows the client keeps in its local SQLite database.

public sealed record PlaylistChange
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public double Position { get; init; }
    public long CreatedAt { get; init; }
    public long UpdatedAt { get; init; }
    public bool Deleted { get; init; }
}

public sealed record VideoChange
{
    public string Id { get; init; } = "";
    public string PlaylistId { get; init; } = "";
    [JsonPropertyName("youtubeId")]
    public string YouTubeId { get; init; } = "";
    public string Title { get; init; } = "";
    public string Author { get; init; } = "";
    public string ThumbnailUrl { get; init; } = "";
    public string Notes { get; init; } = "";
    public bool Watched { get; init; }
    public double Position { get; init; }
    public long CreatedAt { get; init; }
    public long UpdatedAt { get; init; }
    public bool Deleted { get; init; }
}

/// <summary>A batch of rows travelling in either direction.</summary>
public sealed record ChangeSet
{
    public IReadOnlyList<PlaylistChange> Playlists { get; init; } = [];
    public IReadOnlyList<VideoChange> Videos { get; init; } = [];

    [JsonIgnore]
    public int Count => this.Playlists.Count + this.Videos.Count;
}

/// <summary>What a device sends: its local changes and the last server change it has seen.</summary>
public sealed record SyncRequest
{
    public long Since { get; init; }
    public ChangeSet Changes { get; init; } = new();
}

/// <summary>Server changes newer than the device's cursor.</summary>
public sealed record SyncResponse(long Cursor, bool HasMore, int Applied, ChangeSet Changes);

/// <summary>A page of server changes, oldest first.</summary>
public sealed record ChangePage(ChangeSet Changes, long Cursor, bool HasMore);
