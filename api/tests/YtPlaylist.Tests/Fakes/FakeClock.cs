namespace YtPlaylist.Tests;

/// <summary>A clock the test moves forward by hand, for expiry and lockout times.</summary>
internal sealed class FakeClock : TimeProvider
{
    private DateTimeOffset now = DateTimeOffset.UtcNow;

    public override DateTimeOffset GetUtcNow() => this.now;

    public void Advance(TimeSpan by) => this.now += by;
}
