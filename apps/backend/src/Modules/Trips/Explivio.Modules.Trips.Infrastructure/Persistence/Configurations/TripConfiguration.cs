using Explivio.Modules.Trips.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.Modules.Trips.Infrastructure.Persistence.Configurations;

internal sealed class TripConfiguration : IEntityTypeConfiguration<Trip>
{
    public void Configure(EntityTypeBuilder<Trip> builder)
    {
        builder.ToTable("trips");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id)
            .HasConversion(id => id.Value, v => new TripId(v))
            .ValueGeneratedNever()
            .HasColumnName("trip_id");

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired()
            .HasColumnName("title");

        builder.Property(x => x.Description)
            .HasMaxLength(2000)
            .IsRequired(false)
            .HasColumnName("description");

        builder.Property(x => x.StartDate)
            .IsRequired()
            .HasColumnName("start_date");

        builder.Property(x => x.EndDate)
            .IsRequired()
            .HasColumnName("end_date");

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired()
            .HasColumnName("created_at_utc");
        
        builder.Property<byte[]>("row_version")
            .IsConcurrencyToken()
            .HasColumnName("row_version");

        builder.ToTable(tb =>
        {
            tb.HasCheckConstraint("CK_trips_dates", "end_date >= start_date");
        });

        builder.OwnsMany(
            t => t.Participants,
            p =>
            {
                p.ToTable("trip_participants");

                p.WithOwner()
                 .HasForeignKey("trip_id");

                p.HasKey(pp => pp.Id);
                p.Property(pp => pp.Id)
                    .HasConversion(id => id.Value, v => new ParticipantId(v))
                    .ValueGeneratedNever()
                    .HasColumnName("participant_id");

                var emailComparer = new ValueComparer<Email>(
                    (a, b) => a != null && b != null && a.Value == b.Value,
                    e => e.Value.GetHashCode(),
                    e => new Email(e.Value));
                
                p.Property(pp => pp.Email)
                    .HasConversion(e => e.Value, v => new Email(v))
                    .IsRequired()
                    .HasColumnName("email")
                    .Metadata.SetValueComparer(emailComparer);

                p.Property(pp => pp.DisplayName)
                    .HasMaxLength(200)
                    .IsRequired(false)
                    .HasColumnName("display_name");

                p.Property(pp => pp.AddedAtUtc)
                    .IsRequired()
                    .HasColumnName("added_at_utc");

                p.HasIndex("trip_id", nameof(Participant.Email)).IsUnique();
            });

        builder.OwnsMany(
            t => t.DestinationIds,
            d =>
            {
                d.ToTable("trip_destination_ids");

                d.WithOwner()
                 .HasForeignKey("trip_id");

                d.Property(x => x.Value)
                 .HasColumnName("destination_id")
                 .IsRequired();

                d.HasKey("trip_id", "destination_id");
            });

        builder.Navigation(t => t.Participants)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
        
        builder.Navigation(t => t.DestinationIds)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
