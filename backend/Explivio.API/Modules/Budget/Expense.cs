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
    // F25: who fronted the money (a trip member's user id). Null = unsplit / unattributed (the legacy
    // behaviour and reservation-linked expenses). When set together with Shares, the expense feeds the
    // settle-up balances: PaidBy is owed, each share's member owes their portion.
    public Guid? PaidByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    // F25: how this expense is split among trip members. Empty = not split. Amounts are in the
    // expense's own Currency and sum to Amount (enforced by the validator).
    public List<ExpenseShare> Shares { get; } = [];

    public static Expense Create(
        Guid tripId, string description, decimal amount, string currency, ExpenseCategory category, DateOnly date,
        Guid? reservationId = null, Guid? paidByUserId = null, IReadOnlyList<ExpenseShareInput>? shares = null)
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
            PaidByUserId = paidByUserId,
            CreatedAt = DateTime.UtcNow,
        };

        if (shares is { Count: > 0 })
        {
            foreach (var share in shares)
            {
                expense.Shares.Add(new ExpenseShare { UserId = share.UserId, Amount = share.Amount });
            }
        }

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

// F25: one person's portion of a split expense. The person is a trip member (User id); the amount is
// in the parent expense's currency.
public sealed class ExpenseShare
{
    public Guid Id { get; set; }
    public Guid ExpenseId { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
}

// F25: input shape for a split share (used by the AddExpense command).
public sealed record ExpenseShareInput(Guid UserId, decimal Amount);
