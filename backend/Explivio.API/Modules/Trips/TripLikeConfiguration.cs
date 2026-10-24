using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Trips;

public sealed class TripLikeConfiguration : IEntityTypeConfiguration<TripLike>
{
    public void Configure(EntityTypeBuilder<TripLike> builder)
    {
        builder.ToTable("TripLikes");

        // F26: a user can like a trip at most once — enforce it at the database.
        builder.HasIndex(l => new { l.TripId, l.UserId }).IsUnique();
    }
}
