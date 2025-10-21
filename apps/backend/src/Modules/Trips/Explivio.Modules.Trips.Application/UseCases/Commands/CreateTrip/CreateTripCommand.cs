using MediatR;

namespace Explivio.Modules.Trips.Application.UseCases.Commands.CreateTrip;

public sealed record CreateTripCommand(
    string Title,
    string? Description,
    DateTime StartDate,
    DateTime EndDate
) : IRequest<Guid>;