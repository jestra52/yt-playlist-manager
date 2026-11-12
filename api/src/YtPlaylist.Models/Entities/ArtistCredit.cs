namespace YtPlaylist.Models.Entities;

/// <summary>One of a video's artists: <see cref="Role"/> is "main" or "featured".</summary>
public sealed record ArtistCredit(string Name, string Role);
