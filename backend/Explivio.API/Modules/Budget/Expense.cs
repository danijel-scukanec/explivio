using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Budget;

// F08: an aggregate so it can raise the ExpenseAdded event that feeds the read-model projector.
public class Expense : Entity
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public ExpenseCategory Category { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; }

    public static Expense Create(
        Guid tripId, string description, decimal amount, string currency, ExpenseCategory category, DateOnly date)
    {
        var expense = new Expense
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            Description = description,
            Amount = amount,
            Currency = currency,
            Category = category,
            Date = date,
            CreatedAt = DateTime.UtcNow,
        };

        expense.AddDomainEvent(new ExpenseAddedDomainEvent(tripId, amount));
        return expense;
    }
}

public enum ExpenseCategory
{
    Transport,
    Accommodation,
    Food,
    Activities,
    Shopping,
    Other
}
