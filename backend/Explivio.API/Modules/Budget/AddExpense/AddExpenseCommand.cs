using MediatR;

namespace Explivio.API.Modules.Budget.AddExpense;

public record AddExpenseCommand(
    Guid TripId,
    string Description,
    decimal Amount,
    string Currency,
    ExpenseCategory Category,
    DateOnly Date,
    // F25: optional split. When PaidByUserId + Splits are provided, the expense feeds the settle-up
    // balances. Splits are in the expense's Currency and must sum to Amount. Omit both for an
    // unsplit expense (the original behaviour).
    Guid? PaidByUserId = null,
    IReadOnlyList<ExpenseShareInput>? Splits = null
) : IRequest<Guid>;
