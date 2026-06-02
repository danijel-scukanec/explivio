using MediatR;

namespace Explivio.API.Modules.Trips.CreateTrip;

public record CreateTripCommand(
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    Guid UserId
) : IRequest<Guid>;
