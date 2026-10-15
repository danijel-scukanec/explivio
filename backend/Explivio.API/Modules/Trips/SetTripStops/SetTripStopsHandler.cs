using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.SetTripStops;

public class SetTripStopsHandler(AppDbContext db) : IRequestHandler<SetTripStopsCommand, Result>
{
    public async Task<Result> Handle(SetTripStopsCommand command, CancellationToken cancellationToken)
    {
        var trip = await db.Trips
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == command.TripId, cancellationToken);
        if (trip is null)
            return Error.NotFound("Trip.NotFound", $"No trip with id '{command.TripId}' was found.");

        trip.SetStops(command.Stops);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
