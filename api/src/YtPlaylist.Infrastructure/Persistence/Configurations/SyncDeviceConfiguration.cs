using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class SyncDeviceConfiguration : IEntityTypeConfiguration<SyncDevice>
{
    public void Configure(EntityTypeBuilder<SyncDevice> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("sync_devices");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength).ValueGeneratedNever();
        builder.Property(d => d.ChainId).HasColumnName("chain_id").HasMaxLength(SyncLimits.MaxIdLength).IsRequired();
        builder.Property(d => d.CredentialHash)
            .HasColumnName("credential_hash")
            .HasMaxLength(SyncChainConfiguration.HashLength)
            .IsRequired();
        builder.Property(d => d.Name).HasColumnName("name").HasMaxLength(SyncLimits.MaxDeviceNameLength).IsRequired();
        builder.Property(d => d.CreatedAt).HasColumnName("created_at");
        builder.Property(d => d.LastSeenAt).HasColumnName("last_seen_at");
        builder.HasIndex(d => d.CredentialHash).IsUnique();
        builder.HasIndex(d => d.ChainId);
        builder.HasOne<SyncChain>().WithMany().HasForeignKey(d => d.ChainId).OnDelete(DeleteBehavior.Cascade);
    }
}
