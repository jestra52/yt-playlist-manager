using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class SyncChainEventConfiguration : IEntityTypeConfiguration<SyncChainEvent>
{
    private const int MaxKindLength = 32;

    public void Configure(EntityTypeBuilder<SyncChainEvent> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("sync_chain_events");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
        builder.Property(e => e.ChainId).HasColumnName("chain_id").HasMaxLength(SyncLimits.MaxIdLength).IsRequired();
        builder.Property(e => e.At).HasColumnName("at");
        builder.Property(e => e.Kind).HasColumnName("kind").HasMaxLength(MaxKindLength).IsRequired();
        builder.Property(e => e.DeviceName)
            .HasColumnName("device_name")
            .HasMaxLength(SyncLimits.MaxDeviceNameLength)
            .IsRequired();
        builder.Property(e => e.Detail).HasColumnName("detail").HasMaxLength(SyncLimits.MaxTextLength).IsRequired();
        builder.HasIndex(e => new { e.ChainId, e.At });
        builder.HasOne<SyncChain>().WithMany().HasForeignKey(e => e.ChainId).OnDelete(DeleteBehavior.Cascade);
    }
}
