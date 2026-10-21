using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Budget;

public sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.ToTable("Expenses");

        builder.Property(e => e.Amount).HasPrecision(18, 2);
        // Category stays stored as its int value (existing convention) to avoid a data migration.

        // F25: an expense owns its split shares; deleting the expense removes them. Shares are only
        // ever read via their parent expense.
        builder.HasMany(e => e.Shares)
            .WithOne()
            .HasForeignKey(s => s.ExpenseId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ExpenseShareConfiguration : IEntityTypeConfiguration<ExpenseShare>
{
    public void Configure(EntityTypeBuilder<ExpenseShare> builder)
    {
        builder.ToTable("ExpenseShares");
        builder.Property(s => s.Amount).HasPrecision(18, 2);
        builder.HasIndex(s => s.ExpenseId);
    }
}
