using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.DeleteTrip;

public class DeleteTripHandler(AppDbContext db) : IRequestHandler<DeleteTripCommand, Result>
{
    public async Task<Result> Handle(DeleteTripCommand command, CancellationToken cancellationToken)
    {
        // F08: load then remove (instead of a bulk ExecuteDelete) so the aggregate can raise
        // TripDeletedDomainEvent and the outbox interceptor captures it in the same transaction.
        var trip = await db.Trips
            .FirstOrDefaultAsync(t => t.Id == command.TripId && t.UserId == command.UserId, cancellationToken);

        if (trip is null)
        {
            return Error.NotFound("Trip.NotFound", $"No trip with id '{command.TripId}' was found.");
        }

        trip.Delete();
        db.Trips.Remove(trip);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
