using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;

namespace Explivio.API.Modules.Itinerary.CreateActivity;

public class CreateActivityHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<CreateActivityCommand, Guid>
{
    public async Task<Guid> Handle(CreateActivityCommand command, CancellationToken cancellationToken)
    {
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
            command.Longitude);

        db.Activities.Add(activity);
        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "activity.created", cancellationToken);

        return activity.Id;
    }
}
