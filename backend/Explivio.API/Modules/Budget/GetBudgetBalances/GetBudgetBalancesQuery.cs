using MediatR;

namespace Explivio.API.Modules.Budget.GetBudgetBalances;

// F25: who owes whom across a trip's split expenses. Authorized by RequireTripRole(Viewer).
public record GetBudgetBalancesQuery(Guid TripId) : IRequest<BudgetBalancesResponse>;

// A member's standing in the trip base currency: what they paid, what their shares came to, and the
// net (positive = they are owed money; negative = they owe).
public record MemberBalance(Guid UserId, string DisplayName, decimal Paid, decimal Owed, decimal Net);

// A suggested transfer that settles part of the debt: From pays To the given amount (base currency).
public record Settlement(Guid FromUserId, string FromName, Guid ToUserId, string ToName, decimal Amount);

public record BudgetBalancesResponse(
    string BaseCurrency,
    bool ConversionAvailable,
    IReadOnlyList<MemberBalance> Balances,
    IReadOnlyList<Settlement> Settlements);
