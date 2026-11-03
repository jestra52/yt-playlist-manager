using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class SyncRecoveryCodeConfiguration : IEntityTypeConfiguration<SyncRecoveryCode>
{
    public void Configure(EntityTypeBuilder<SyncRecoveryCode> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("sync_recovery_codes");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength).ValueGeneratedNever();
        builder.Property(r => r.ChainId).HasColumnName("chain_id").HasMaxLength(SyncLimits.MaxIdLength).IsRequired();
        builder.Property(r => r.CodeHash)
            .HasColumnName("code_hash")
            .HasMaxLength(SyncChainConfiguration.HashLength)
            .IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");
        builder.HasIndex(r => r.CodeHash).IsUnique();
        builder.HasIndex(r => r.ChainId);
        builder.HasOne<SyncChain>().WithMany().HasForeignKey(r => r.ChainId).OnDelete(DeleteBehavior.Cascade);
    }
}
