using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.GetTrip;

public record GetTripQuery(Guid TripId, Guid UserId) : IRequest<Result<TripResponse>>;

public record TripResponse(
    Guid Id,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    DateTime CreatedAt
);
