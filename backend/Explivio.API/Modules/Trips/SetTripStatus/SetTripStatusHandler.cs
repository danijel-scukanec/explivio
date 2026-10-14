using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.SetTripStatus;

public class SetTripStatusHandler(AppDbContext db) : IRequestHandler<SetTripStatusCommand, Result>
{
    public async Task<Result> Handle(SetTripStatusCommand command, CancellationToken cancellationToken)
    {
        var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == command.TripId, cancellationToken);
        if (trip is null)
            return Error.NotFound("Trip.NotFound", $"No trip with id '{command.TripId}' was found.");

        trip.SetStatus(command.Status);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
