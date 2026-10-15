using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Trips;

public sealed class TripStopConfiguration : IEntityTypeConfiguration<TripStop>
{
    public void Configure(EntityTypeBuilder<TripStop> builder)
    {
        builder.ToTable("TripStops");

        builder.Property(s => s.Place).HasMaxLength(200);

        // The route is always read in order, so index the lookup the queries use.
        builder.HasIndex(s => new { s.TripId, s.Order });
    }
}
