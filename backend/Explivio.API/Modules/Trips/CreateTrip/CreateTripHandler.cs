using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Trips.CreateTrip;

public class CreateTripHandler(AppDbContext db) : IRequestHandler<CreateTripCommand, Guid>
{
    public async Task<Guid> Handle(CreateTripCommand command, CancellationToken cancellationToken)
    {
        var trip = Trip.Create(
            command.Name,
            command.Destination,
            command.StartDate,
            command.EndDate,
            command.TravelerCount,
            command.UserId);

        db.Trips.Add(trip);
        await db.SaveChangesAsync(cancellationToken);

        return trip.Id;
    }
}
