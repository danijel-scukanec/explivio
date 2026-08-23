using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Infrastructure.Outbox;

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("OutboxMessages");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Type).HasMaxLength(200);
        builder.Property(m => m.Content).HasColumnType("nvarchar(max)");

        // The processor scans for the unprocessed backlog every tick; index that predicate.
        builder.HasIndex(m => m.ProcessedOnUtc);
    }
}
