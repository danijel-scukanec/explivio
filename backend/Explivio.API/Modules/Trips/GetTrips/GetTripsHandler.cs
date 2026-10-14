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
        return await db.Trips
            .Where(t => db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == query.UserId))
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TripResponse(t.Id, t.Name, t.Destination, t.StartDate, t.EndDate, t.TravelerCount, t.Status, t.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
