using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Trips;

public sealed class TripMemberConfiguration : IEntityTypeConfiguration<TripMember>
{
    public void Configure(EntityTypeBuilder<TripMember> builder)
    {
        builder.ToTable("TripMembers");

        // One membership row per (trip, user); the pair is the natural key.
        builder.HasKey(m => new { m.TripId, m.UserId });

        // Stored as its name ("Owner"/"Editor"/"Viewer") so the column is readable and stable if the
        // enum's numeric values ever change.
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);

        // Listing "my trips" filters by UserId, so index it.
        builder.HasIndex(m => m.UserId);
    }
}
