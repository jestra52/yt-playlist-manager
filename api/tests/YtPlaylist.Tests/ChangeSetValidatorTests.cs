using YtPlaylist.Application.Sync;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Sync;

namespace YtPlaylist.Tests;

public sealed class ChangeSetValidatorTests
{
    private static PlaylistChange Playlist(string id = "p1", string name = "Mine") =>
        new() { Id = id, Name = name, CreatedAt = 1, UpdatedAt = 2 };

    private static VideoChange Video(string youTubeId = "dQw4w9WgXcQ", string notes = "") => new()
    {
        Id = "v1",
        PlaylistId = "p1",
        YouTubeId = youTubeId,
        Notes = notes,
        CreatedAt = 1,
        UpdatedAt = 2,
    };

    [Fact]
    public void AcceptsValidRows() =>
        ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist()], Videos = [Video()] });

    [Theory]
    [InlineData("")]
    [InlineData("has space")]
    [InlineData("../etc")]
    public void RejectsBadIds(string id) =>
        Assert.Throws<DomainValidationException>(() => ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist(id)] }));

    [Fact]
    public void RejectsUnnamedPlaylistsUnlessDeleted()
    {
        Assert.Throws<DomainValidationException>(() => ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist(name: "")] }));
        ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist(name: "") with { Deleted = true }] });
    }

    [Fact]
    public void RejectsInvalidYouTubeIds() =>
        Assert.Throws<DomainValidationException>(() => ChangeSetValidator.Validate(new ChangeSet { Videos = [Video("nope")] }));

    [Fact]
    public void AcceptsPlaceholdersWithATitle()
    {
        ChangeSetValidator.Validate(new ChangeSet { Videos = [Video("") with { Title = "Anri - Windy Summer" }] });
        ChangeSetValidator.Validate(new ChangeSet { Videos = [Video("") with { Deleted = true }] });
        Assert.Throws<DomainValidationException>(() => ChangeSetValidator.Validate(new ChangeSet { Videos = [Video("")] }));
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Videos = [Video("") with { Title = "   " }] }));
    }

    [Fact]
    public void CountsCharactersNotBytes()
    {
        ChangeSetValidator.Validate(new ChangeSet { Videos = [Video(notes: string.Concat(Enumerable.Repeat("🎵", 5000)))] });
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Videos = [Video(notes: new string('a', 5001))] }));
    }

    [Fact]
    public void ChecksThePlaylistSource()
    {
        ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { Source = "youtube", SourceId = "PLrAXtmErZgOeiKm4sgN" }] });
        ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { Source = "", SourceId = "" }] });
        ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { Source = null, SourceId = null }] });
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { Source = "YouTube" }] }));
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { Source = "youtube", SourceId = "PL../etc" }] }));
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { SourceId = new string('a', 65) }] }));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("guess")]
    [InlineData("musicbrainz")]
    public void AcceptsKnownAndFutureArtistSources(string? source) =>
        ChangeSetValidator.Validate(new ChangeSet { Videos = [Video() with { Artist = "Anri", ArtistSource = source }] });

    [Theory]
    [InlineData("Guess")]
    [InlineData("not a word")]
    [InlineData("averyveryverylongsourcenamethatgoesonandon")]
    public void RejectsInvalidArtistSources(string source) =>
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Videos = [Video() with { ArtistSource = source }] }));

    [Fact]
    public void LimitsTheArtistLength() =>
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Videos = [Video() with { Artist = new string('a', 201) }] }));

    [Fact]
    public void RejectsMissingTimestampsAndOversizedBatches()
    {
        Assert.Throws<DomainValidationException>(
            () => ChangeSetValidator.Validate(new ChangeSet { Playlists = [Playlist() with { CreatedAt = 0 }] }));
        var many = Enumerable.Range(0, SyncLimits.MaxRowsPerSync + 1).Select(i => Playlist($"p{i}")).ToList();
        Assert.Throws<DomainValidationException>(() => ChangeSetValidator.Validate(new ChangeSet { Playlists = many }));
    }
}
