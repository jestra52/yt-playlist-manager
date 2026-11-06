using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class ReportConfiguration : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("reports");
        builder.HasKey(r => new { r.ChainId, r.Id });
        builder.Property(r => r.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength);
        builder.Property(r => r.ChainId).HasColumnName("chain_id").HasMaxLength(SyncLimits.MaxIdLength);
        builder.Property(r => r.PlaylistId)
            .HasColumnName("playlist_id")
            .HasMaxLength(SyncLimits.MaxIdLength)
            .IsRequired();
        builder.Property(r => r.PlaylistName)
            .HasColumnName("playlist_name")
            .HasMaxLength(SyncLimits.MaxNameLength)
            .IsRequired();
        builder.Property(r => r.Reason).HasColumnName("reason").HasMaxLength(SyncLimits.MaxReasonLength).IsRequired();
        builder.Property(r => r.VideoCount).HasColumnName("video_count");
        builder.Property(r => r.Content).HasColumnName("content").IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");
        builder.HasIndex(r => new { r.ChainId, r.PlaylistId, r.CreatedAt });
        builder.HasOne<SyncChain>().WithMany().HasForeignKey(r => r.ChainId).OnDelete(DeleteBehavior.Cascade);
    }
}
