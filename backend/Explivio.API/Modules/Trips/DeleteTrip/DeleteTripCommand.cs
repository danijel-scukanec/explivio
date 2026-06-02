using MediatR;

namespace Explivio.API.Modules.Trips.DeleteTrip;

public record DeleteTripCommand(Guid TripId, Guid UserId) : IRequest<bool>;
