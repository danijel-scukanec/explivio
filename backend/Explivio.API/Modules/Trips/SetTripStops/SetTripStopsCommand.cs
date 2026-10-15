using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.SetTripStops;

// F22: replace a trip's whole ordered route (add/remove/reorder/edit in one save). Access is
// authorized by RequireTripRole(Editor) before the handler runs.
public record SetTripStopsCommand(Guid TripId, IReadOnlyList<TripStopInput> Stops) : IRequest<Result>;

// Request body for PUT /trips/{id}/stops — the id comes from the route.
public record SetTripStopsRequest(IReadOnlyList<TripStopInput> Stops);
