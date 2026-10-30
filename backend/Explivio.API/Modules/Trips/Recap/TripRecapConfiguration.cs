using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Trips.Recap;

public class TripRecapConfiguration : IEntityTypeConfiguration<TripRecap>
{
    public void Configure(EntityTypeBuilder<TripRecap> builder)
    {
        // One recap per trip — TripId is the primary key (1:1 with Trip).
        builder.HasKey(r => r.TripId);
        builder.Property(r => r.Content);
        builder.Property(r => r.Model).HasMaxLength(100);
    }
}
