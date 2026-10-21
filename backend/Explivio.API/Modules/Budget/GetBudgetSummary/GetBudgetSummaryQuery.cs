using MediatR;

namespace Explivio.API.Modules.Budget.GetBudgetSummary;

// F25: access is authorized by RequireTripRole(Viewer) on the endpoint before the handler runs.
public record GetBudgetSummaryQuery(Guid TripId) : IRequest<BudgetSummaryResponse>;
