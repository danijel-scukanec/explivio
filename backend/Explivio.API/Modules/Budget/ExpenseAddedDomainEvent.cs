using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Budget;

// F08: raised when an expense is added to a trip, so the read-model projector can add the amount
// to the trip's TotalSpend. (Amount is summed regardless of Currency for now — see the read model.)
public sealed record ExpenseAddedDomainEvent(Guid TripId, decimal Amount) : IDomainEvent;
