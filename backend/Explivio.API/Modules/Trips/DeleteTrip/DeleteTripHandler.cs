using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.DeleteTrip;

public class DeleteTripHandler(AppDbContext db) : IRequestHandler<DeleteTripCommand, Result>
{
    public async Task<Result> Handle(DeleteTripCommand command, CancellationToken cancellationToken)
    {
        var deleted = await db.Trips
            .Where(t => t.Id == command.TripId && t.UserId == command.UserId)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted > 0
            ? Result.Success()
            : Error.NotFound("Trip.NotFound", $"No trip with id '{command.TripId}' was found.");
    }
}
