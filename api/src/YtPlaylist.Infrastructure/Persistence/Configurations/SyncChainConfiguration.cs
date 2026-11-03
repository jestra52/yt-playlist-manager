using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

public sealed class SyncChainConfiguration : IEntityTypeConfiguration<SyncChain>
{
    /// <summary>Base64url of a 32-byte HMAC-SHA256.</summary>
    internal const int HashLength = 43;

    public void Configure(EntityTypeBuilder<SyncChain> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.ToTable("sync_chains");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id").HasMaxLength(SyncLimits.MaxIdLength).ValueGeneratedNever();
        builder.Property(c => c.SecretHash).HasColumnName("secret_hash").HasMaxLength(HashLength);
        builder.Property(c => c.CreatedAt).HasColumnName("created_at");
        builder.Property(c => c.PairingLockedUntil).HasColumnName("pairing_locked_until");
        builder.HasIndex(c => c.SecretHash).IsUnique();

        // Every row synced with SYNC_TOKEN before sync chains belongs here until it's claimed.
        builder.HasData(new SyncChain { Id = SyncChain.LegacyId, SecretHash = null, CreatedAt = 0 });
    }
}
