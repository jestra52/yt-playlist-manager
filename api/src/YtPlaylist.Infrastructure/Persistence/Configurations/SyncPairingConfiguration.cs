using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class SyncPairingConfiguration : IEntityTypeConfiguration<SyncPairing>
{
    public void Configure(EntityTypeBuilder<SyncPairing> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("sync_pairings");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength).ValueGeneratedNever();
        builder.Property(p => p.ChainId).HasColumnName("chain_id").HasMaxLength(SyncLimits.MaxIdLength).IsRequired();
        builder.Property(p => p.CreatedByDeviceId)
            .HasColumnName("created_by_device_id")
            .HasMaxLength(SyncLimits.MaxIdLength)
            .IsRequired();
        builder.Property(p => p.CodeHash).HasColumnName("code_hash").HasMaxLength(SyncChainConfiguration.HashLength).IsRequired();
        builder.Property(p => p.Status).HasColumnName("status").HasMaxLength(16).IsRequired();
        builder.Property(p => p.CreatedAt).HasColumnName("created_at");
        builder.Property(p => p.ExpiresAt).HasColumnName("expires_at");
        builder.Property(p => p.RequesterName)
            .HasColumnName("requester_name")
            .HasMaxLength(SyncLimits.MaxDeviceNameLength)
            .IsRequired();
        builder.Property(p => p.RequestTokenHash).HasColumnName("request_token_hash").HasMaxLength(SyncChainConfiguration.HashLength);
        builder.HasIndex(p => p.CodeHash).IsUnique();
        builder.HasIndex(p => p.RequestTokenHash).IsUnique();
        builder.HasIndex(p => p.CreatedByDeviceId);
        builder.HasIndex(p => p.ExpiresAt);
        builder.HasOne<SyncChain>().WithMany().HasForeignKey(p => p.ChainId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<SyncDevice>().WithMany().HasForeignKey(p => p.CreatedByDeviceId).OnDelete(DeleteBehavior.Cascade);
    }
}
