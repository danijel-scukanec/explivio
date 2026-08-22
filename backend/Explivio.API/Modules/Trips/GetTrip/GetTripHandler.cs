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
            .Where(t => t.Id == query.TripId && t.UserId == query.UserId)
            .Select(t => new TripResponse(t.Id, t.Name, t.Destination, t.StartDate, t.EndDate, t.TravelerCount, t.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        return trip is null
            ? Error.NotFound("Trip.NotFound", $"No trip with id '{query.TripId}' was found.")
            : trip;
    }
}
