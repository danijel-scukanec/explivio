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
    // F23: set when this expense was created from a booking's cost. Such an expense is managed from the
    // reservation (its cost edits/removes this row), so the budget UI shows it as "from booking" and
    // doesn't let it be deleted there — keeping the two from drifting apart.
    public Guid? ReservationId { get; set; }
    public DateTime CreatedAt { get; set; }

    public static Expense Create(
        Guid tripId, string description, decimal amount, string currency, ExpenseCategory category, DateOnly date,
        Guid? reservationId = null)
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
            ReservationId = reservationId,
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
