using Explivio.Modules.Trips.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.Modules.Trips.Infrastructure.Persistence.Configurations;

internal sealed class DestinationConfiguration : IEntityTypeConfiguration<Destination>
{
    public void Configure(EntityTypeBuilder<Destination> builder)
    {
        builder.ToTable("destinations");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id)
            .HasConversion(id => id.Value, v => new DestinationId(v))
            .ValueGeneratedNever()
            .HasColumnName("destination_id");

        builder.Property(x => x.Name)
            .HasMaxLength(200)
            .IsRequired()
            .HasColumnName("name");

        builder.Property(x => x.Description)
            .HasMaxLength(2000)
            .HasColumnName("description");

        builder.Property<byte[]>("row_version")
            .IsConcurrencyToken()
            .HasColumnName("row_version");

        builder.HasIndex(x => x.Name);
    }
}