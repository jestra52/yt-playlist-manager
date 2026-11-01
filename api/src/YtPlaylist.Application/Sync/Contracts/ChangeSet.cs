using System.Text.Json.Serialization;

namespace YtPlaylist.Application.Sync;

/// <summary>A batch of rows travelling in either direction.</summary>
public sealed record ChangeSet
{
    public IReadOnlyList<PlaylistChange> Playlists { get; init; } = [];
    public IReadOnlyList<VideoChange> Videos { get; init; } = [];

    [JsonIgnore]
    public int Count => this.Playlists.Count + this.Videos.Count;
}
