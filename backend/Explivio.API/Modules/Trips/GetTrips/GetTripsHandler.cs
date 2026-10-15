using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.GetTrip;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.GetTrips;

public class GetTripsHandler(AppDbContext db) : IRequestHandler<GetTripsQuery, List<TripResponse>>
{
    public async Task<List<TripResponse>> Handle(GetTripsQuery query, CancellationToken cancellationToken)
    {
        // F15: return every trip the user is a member of (owner or shared), not just ones they own.
        var trips = await db.Trips
            .Where(t => db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == query.UserId))
            .Include(t => t.Stops)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        // F22: the destination summary is derived from each trip's stops (string.Join doesn't
        // translate to SQL), so map in memory after loading. A user's trip list is small.
        return trips.Select(t => t.ToResponse()).ToList();
    }
}
