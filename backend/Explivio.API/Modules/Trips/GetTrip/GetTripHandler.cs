using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.GetTrip;

public class GetTripHandler(AppDbContext db) : IRequestHandler<GetTripQuery, Result<TripResponse>>
{
    public async Task<Result<TripResponse>> Handle(GetTripQuery query, CancellationToken cancellationToken)
    {
        var trip = await db.Trips
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == query.TripId, cancellationToken);

        return trip is null
            ? Error.NotFound("Trip.NotFound", $"No trip with id '{query.TripId}' was found.")
            : trip.ToResponse();
    }
}
