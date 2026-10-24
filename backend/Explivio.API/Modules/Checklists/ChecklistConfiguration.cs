using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Checklists;

public class ChecklistConfiguration : IEntityTypeConfiguration<Checklist>
{
    public void Configure(EntityTypeBuilder<Checklist> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(200);
        builder.HasIndex(c => c.TripId);

        // The items are owned by their list: delete the list, its items go with it.
        builder.HasMany(c => c.Items)
            .WithOne()
            .HasForeignKey(i => i.ChecklistId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ChecklistItemConfiguration : IEntityTypeConfiguration<ChecklistItem>
{
    public void Configure(EntityTypeBuilder<ChecklistItem> builder)
    {
        builder.Property(i => i.Text).HasMaxLength(500);
        builder.HasIndex(i => i.ChecklistId);
    }
}
