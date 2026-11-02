using Microsoft.EntityFrameworkCore;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>Entity Framework Core context for the cloud copy of every device's data.</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Playlist> Playlists => this.Set<Playlist>();
    public DbSet<Video> Videos => this.Set<Video>();
    public DbSet<SyncCounter> SyncCounters => this.Set<SyncCounter>();
    public DbSet<SyncChain> SyncChains => this.Set<SyncChain>();
    public DbSet<SyncDevice> SyncDevices => this.Set<SyncDevice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
