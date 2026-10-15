using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Trips.CreateTrip;

public class CreateTripHandler(AppDbContext db) : IRequestHandler<CreateTripCommand, Guid>
{
    public async Task<Guid> Handle(CreateTripCommand command, CancellationToken cancellationToken)
    {
        var trip = Trip.Create(
            command.Name,
            command.StartDate,
            command.EndDate,
            command.TravelerCount,
            command.UserId,
            command.Stops);

        db.Trips.Add(trip);

        // F15: the creator becomes the trip's Owner member. All trip-scoped authorization is decided
        // from TripMembers, so this is what grants the creator access to their own trip.
        db.TripMembers.Add(TripMember.Create(trip.Id, command.UserId, TripRole.Owner));

        await db.SaveChangesAsync(cancellationToken);

        return trip.Id;
    }
}
