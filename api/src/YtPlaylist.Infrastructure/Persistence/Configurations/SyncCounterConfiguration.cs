using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YtPlaylist.Domain.Common;

namespace YtPlaylist.Infrastructure.Persistence.Configurations;

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
