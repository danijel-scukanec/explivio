using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Documents;

public class TripDocumentConfiguration : IEntityTypeConfiguration<TripDocument>
{
    public void Configure(EntityTypeBuilder<TripDocument> builder)
    {
        builder.Property(d => d.FileName).HasMaxLength(260);
        builder.Property(d => d.ContentType).HasMaxLength(200);
        builder.HasIndex(d => d.TripId);
    }
}
