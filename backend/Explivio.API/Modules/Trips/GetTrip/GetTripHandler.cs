using Explivio.API.Infrastructure.Database;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.GetTrip;

public class GetTripHandler(AppDbContext db) : IRequestHandler<GetTripQuery, TripResponse?>
{
    public async Task<TripResponse?> Handle(GetTripQuery query, CancellationToken cancellationToken)
    {
        return await db.Trips
            .Where(t => t.Id == query.TripId && t.UserId == query.UserId)
            .Select(t => new TripResponse(t.Id, t.Name, t.Destination, t.StartDate, t.EndDate, t.TravelerCount, t.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
