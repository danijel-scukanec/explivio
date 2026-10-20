using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Itinerary.CreateActivity;

public class CreateActivityHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<CreateActivityCommand, Guid>
{
    public async Task<Guid> Handle(CreateActivityCommand command, CancellationToken cancellationToken)
    {
        // F23: append to the end of its day. Ordering is per (trip, date), so a new activity gets the
        // next slot after the current last one on that date.
        var lastOrder = await db.Activities
            .Where(a => a.TripId == command.TripId && a.Date == command.Date)
            .Select(a => (int?)a.SortOrder)
            .MaxAsync(cancellationToken);

        var activity = Activity.Create(
            command.TripId,
            command.Name,
            command.Description,
            command.Location,
            command.Date,
            command.StartTime,
            command.EndTime,
            command.Category,
            command.Latitude,
            command.Longitude,
            (lastOrder ?? -1) + 1);

        db.Activities.Add(activity);
        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "activity.created", cancellationToken);

        return activity.Id;
    }
}
