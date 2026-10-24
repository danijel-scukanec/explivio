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

        // F25: ISO 4217 code — fixed 3 chars. The DB default backfills existing trips (and any insert
        // that somehow omits it) to EUR, matching the entity's default.
        builder.Property(t => t.BaseCurrency).HasMaxLength(3).IsFixedLength().HasDefaultValue("EUR");

        // F26: the share token is an unguessable handle for link-sharing. Bounded length, and unique so
        // a token resolves to exactly one trip (filtered: many trips have none).
        builder.Property(t => t.ShareToken).HasMaxLength(64);
        builder.HasIndex(t => t.ShareToken).IsUnique().HasFilter("[ShareToken] IS NOT NULL");

        // F26: listing the public gallery filters on IsPublic.
        builder.HasIndex(t => t.IsPublic);

        // F22: a trip owns its ordered stops; deleting the trip removes them.
        builder.HasMany(t => t.Stops)
            .WithOne()
            .HasForeignKey(s => s.TripId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
