using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Trips.CreateTrip;

public class CreateTripHandler(AppDbContext db) : IRequestHandler<CreateTripCommand, Guid>
{
    public async Task<Guid> Handle(CreateTripCommand command, CancellationToken cancellationToken)
    {
        var trip = new Trip
        {
            Id = Guid.NewGuid(),
            Name = command.Name,
            Destination = command.Destination,
            StartDate = command.StartDate,
            EndDate = command.EndDate,
            TravelerCount = command.TravelerCount,
            UserId = command.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Trips.Add(trip);
        await db.SaveChangesAsync(cancellationToken);

        return trip.Id;
    }
}
