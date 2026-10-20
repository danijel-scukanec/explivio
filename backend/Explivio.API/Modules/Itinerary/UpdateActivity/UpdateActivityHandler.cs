using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Itinerary.UpdateActivity;

public class UpdateActivityHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<UpdateActivityCommand, bool>
{
    public async Task<bool> Handle(UpdateActivityCommand command, CancellationToken cancellationToken)
    {
        var activity = await db.Activities
            .FirstOrDefaultAsync(a => a.Id == command.Id && a.TripId == command.TripId, cancellationToken);
        if (activity is null)
        {
            return false;
        }

        // F23: if the activity moves to a different day, append it to the end of that day; otherwise it
        // keeps its place. Reordering within a day goes through the reorder endpoint, not here.
        var sortOrder = activity.SortOrder;
        if (command.Date != activity.Date)
        {
            var lastOrder = await db.Activities
                .Where(a => a.TripId == command.TripId && a.Date == command.Date && a.Id != command.Id)
                .Select(a => (int?)a.SortOrder)
                .MaxAsync(cancellationToken);
            sortOrder = (lastOrder ?? -1) + 1;
        }

        activity.Update(
            command.Name,
            command.Description,
            command.Location,
            command.Date,
            command.StartTime,
            command.EndTime,
            command.Category,
            command.Latitude,
            command.Longitude,
            sortOrder);

        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "activity.updated", cancellationToken);

        return true;
    }
}
