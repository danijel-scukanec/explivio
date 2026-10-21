using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.SetTripBaseCurrency;

// F25: change the currency the trip's budget is reported in. Access is authorized by
// RequireTripRole(Editor) before the handler runs.
public record SetTripBaseCurrencyCommand(Guid TripId, string BaseCurrency) : IRequest<Result>;

// Request body for PATCH /trips/{id}/base-currency — the id comes from the route.
public record SetTripBaseCurrencyRequest(string BaseCurrency);
