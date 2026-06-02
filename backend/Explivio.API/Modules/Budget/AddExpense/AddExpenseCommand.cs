using MediatR;

namespace Explivio.API.Modules.Budget.AddExpense;

public record AddExpenseCommand(
    Guid TripId,
    string Description,
    decimal Amount,
    string Currency,
    ExpenseCategory Category,
    DateOnly Date
) : IRequest<Guid>;
