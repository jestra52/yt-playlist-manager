using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class VideoConfiguration : IEntityTypeConfiguration<Video>
{
    public void Configure(EntityTypeBuilder<Video> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("videos");
        builder.HasKey(v => new { v.ChainId, v.Id });
        builder.Property(v => v.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength);
        // Rows from before sync chains (synced with SYNC_TOKEN) belong to the legacy chain.
        builder.Property(v => v.ChainId)
            .HasColumnName("chain_id")
            .HasMaxLength(SyncLimits.MaxIdLength)
            .HasDefaultValue(SyncChain.LegacyId)
            .IsRequired();
        builder.Property(v => v.PlaylistId)
            .HasColumnName("playlist_id")
            .HasMaxLength(SyncLimits.MaxIdLength)
            .IsRequired();
        builder.Property(v => v.YouTubeId).HasColumnName("youtube_id").HasMaxLength(11).IsRequired();
        builder.Property(v => v.Title).HasColumnName("title").HasMaxLength(SyncLimits.MaxTitleLength).IsRequired();
        builder.Property(v => v.Author).HasColumnName("author").HasMaxLength(SyncLimits.MaxNameLength).IsRequired();
        builder.Property(v => v.Artist).HasColumnName("artist").HasMaxLength(SyncLimits.MaxNameLength).IsRequired();
        builder.Property(v => v.ArtistSource)
            .HasColumnName("artist_source")
            .HasMaxLength(SyncLimits.MaxSourceLength)
            .IsRequired();
        builder.Property(v => v.ThumbnailUrl)
            .HasColumnName("thumbnail_url")
            .HasMaxLength(SyncLimits.MaxUrlLength)
            .IsRequired();
        builder.Property(v => v.Notes).HasColumnName("notes").HasMaxLength(SyncLimits.MaxTextLength).IsRequired();
        builder.Property(v => v.Watched).HasColumnName("watched");
        builder.Property(v => v.Unavailable).HasColumnName("unavailable");
        builder.Property(v => v.Position).HasColumnName("position");
        builder.Property(v => v.CreatedAt).HasColumnName("created_at");
        builder.Property(v => v.UpdatedAt).HasColumnName("updated_at");
        builder.Property(v => v.Deleted).HasColumnName("deleted");
        builder.Property(v => v.Seq).HasColumnName("seq");
        builder.HasIndex(v => new { v.ChainId, v.Seq });
        builder.HasIndex(v => new { v.ChainId, v.PlaylistId });
        builder.HasOne<SyncChain>().WithMany().HasForeignKey(v => v.ChainId).OnDelete(DeleteBehavior.Cascade);
    }
}
