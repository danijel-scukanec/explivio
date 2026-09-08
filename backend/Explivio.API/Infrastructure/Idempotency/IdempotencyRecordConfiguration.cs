using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Infrastructure.Idempotency;

public sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("IdempotencyRecords");

        // Composite key: a client's key is unique per user. Reserving this pair is the atomic
        // "claim" that makes concurrent duplicates collide on insert.
        builder.HasKey(r => new { r.UserId, r.Key });
        builder.Property(r => r.Key).HasMaxLength(200);
        builder.Property(r => r.ContentType).HasMaxLength(200);
    }
}
