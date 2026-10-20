using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Itinerary.ReorderActivities;

public class ReorderActivitiesHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<ReorderActivitiesCommand>
{
    public async Task Handle(ReorderActivitiesCommand command, CancellationToken cancellationToken)
    {
        // Load only the trip's activities named in the request, then assign SortOrder by position.
        // Ids that don't belong to the trip (or don't exist) are simply ignored.
        var activities = await db.Activities
            .Where(a => a.TripId == command.TripId && command.OrderedActivityIds.Contains(a.Id))
            .ToListAsync(cancellationToken);

        var byId = activities.ToDictionary(a => a.Id);
        for (var i = 0; i < command.OrderedActivityIds.Count; i++)
        {
            if (byId.TryGetValue(command.OrderedActivityIds[i], out var activity))
            {
                activity.SortOrder = i;
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "activity.reordered", cancellationToken);
    }
}
