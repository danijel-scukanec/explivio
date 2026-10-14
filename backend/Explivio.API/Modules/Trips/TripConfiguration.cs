using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Trips;

public sealed class TripConfiguration : IEntityTypeConfiguration<Trip>
{
    public void Configure(EntityTypeBuilder<Trip> builder)
    {
        builder.ToTable("Trips");

        // F22: stored as its name ("Planned"/"Active"/…) so the column is readable and stable if the
        // enum's numeric values ever change — same convention as TripMember.Role.
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
    }
}
