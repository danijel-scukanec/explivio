using Explivio.Modules.Trips.Application.Abstractions;
using Explivio.Modules.Trips.Application.Abstractions.Repositories;
using Explivio.Modules.Trips.Domain;
using MediatR;

namespace Explivio.Modules.Trips.Application.UseCases.Commands.CreateTrip;

internal sealed class CreateTripCommandHandler : IRequestHandler<CreateTripCommand, Guid>
{
    private readonly ITripRepository _trips;
    private readonly IUnitOfWork _uow;

    public CreateTripCommandHandler(ITripRepository trips, IUnitOfWork uow)
    {
        _trips = trips;
        _uow = uow;
    }

    public async Task<Guid> Handle(CreateTripCommand r, CancellationToken ct)
    {
        var trip = Trip.Create(r.Title, r.Description, r.StartDate, r.EndDate);
        await _trips.AddAsync(trip, ct);
        await _uow.SaveChangesAsync(ct);
        return trip.Id.Value;
    }
}