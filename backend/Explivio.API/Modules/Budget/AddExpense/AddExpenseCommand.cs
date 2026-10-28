using System.Text.Json.Serialization;
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
    IReadOnlyList<ExpenseShareInput>? Splits = null,
    // F20: the authenticated caller, set by the endpoint — used to notify the trip's other members.
    // [JsonIgnore]: server-set from the auth context, so it's never part of the request body (clients
    // can't spoof it) and stays out of the OpenAPI schema.
    [property: JsonIgnore] Guid ActorUserId = default
) : IRequest<Guid>;
