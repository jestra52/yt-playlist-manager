using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

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
        builder.Property(p => p.Source).HasColumnName("source").HasMaxLength(SyncLimits.MaxSourceLength).IsRequired();
        builder.Property(p => p.SourceId).HasColumnName("source_id").HasMaxLength(SyncLimits.MaxIdLength).IsRequired();
        builder.Property(p => p.CreatedAt).HasColumnName("created_at");
        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at");
        builder.Property(p => p.Deleted).HasColumnName("deleted");
        builder.Property(p => p.Seq).HasColumnName("seq");
        builder.HasIndex(p => p.Seq);
    }
}
