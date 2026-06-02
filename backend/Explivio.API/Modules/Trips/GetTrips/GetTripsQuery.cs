using Explivio.API.Modules.Trips.GetTrip;
using MediatR;

namespace Explivio.API.Modules.Trips.GetTrips;

public record GetTripsQuery(Guid UserId) : IRequest<List<TripResponse>>;
