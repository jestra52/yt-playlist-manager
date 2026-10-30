using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Domain.Playlists;
using YtPlaylist.Domain.Videos;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class PlaylistConfiguration : IEntityTypeConfiguration<Playlist>
{
    public void Configure(EntityTypeBuilder<Playlist> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("playlists");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength);
        builder.Property(p => p.Name).HasColumnName("name").HasMaxLength(SyncLimits.MaxNameLength).IsRequired();
        builder.Property(p => p.Description)
            .HasColumnName("description")
            .HasMaxLength(SyncLimits.MaxTextLength)
            .IsRequired();
        builder.Property(p => p.Position).HasColumnName("position");
        builder.Property(p => p.CreatedAt).HasColumnName("created_at");
        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at");
        builder.Property(p => p.Deleted).HasColumnName("deleted");
        builder.Property(p => p.Seq).HasColumnName("seq");
        builder.HasIndex(p => p.Seq);
    }
}

public sealed class VideoConfiguration : IEntityTypeConfiguration<Video>
{
    public void Configure(EntityTypeBuilder<Video> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("videos");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength);
        builder.Property(v => v.PlaylistId)
            .HasColumnName("playlist_id")
            .HasMaxLength(SyncLimits.MaxIdLength)
            .IsRequired();
        builder.Property(v => v.YouTubeId).HasColumnName("youtube_id").HasMaxLength(11).IsRequired();
        builder.Property(v => v.Title).HasColumnName("title").HasMaxLength(SyncLimits.MaxTitleLength).IsRequired();
        builder.Property(v => v.Author).HasColumnName("author").HasMaxLength(SyncLimits.MaxNameLength).IsRequired();
        builder.Property(v => v.ThumbnailUrl)
            .HasColumnName("thumbnail_url")
            .HasMaxLength(SyncLimits.MaxUrlLength)
            .IsRequired();
        builder.Property(v => v.Notes).HasColumnName("notes").HasMaxLength(SyncLimits.MaxTextLength).IsRequired();
        builder.Property(v => v.Watched).HasColumnName("watched");
        builder.Property(v => v.Position).HasColumnName("position");
        builder.Property(v => v.CreatedAt).HasColumnName("created_at");
        builder.Property(v => v.UpdatedAt).HasColumnName("updated_at");
        builder.Property(v => v.Deleted).HasColumnName("deleted");
        builder.Property(v => v.Seq).HasColumnName("seq");
        builder.HasIndex(v => v.Seq);
        builder.HasIndex(v => v.PlaylistId);
    }
}

public sealed class SyncCounterConfiguration : IEntityTypeConfiguration<SyncCounter>
{
    public void Configure(EntityTypeBuilder<SyncCounter> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("sync_counter");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(c => c.Value).HasColumnName("value");
        builder.HasData(new SyncCounter { Id = SyncCounter.SingletonId, Value = 0 });
    }
}
