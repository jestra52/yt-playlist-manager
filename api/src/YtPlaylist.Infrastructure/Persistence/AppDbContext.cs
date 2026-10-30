using Microsoft.EntityFrameworkCore;
using YtPlaylist.Domain.Common;
using YtPlaylist.Domain.Playlists;
using YtPlaylist.Domain.Videos;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Entity Framework Core context for the cloud copy of every device's data.</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<Video> Videos => Set<Video>();
    public DbSet<SyncCounter> SyncCounters => Set<SyncCounter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
