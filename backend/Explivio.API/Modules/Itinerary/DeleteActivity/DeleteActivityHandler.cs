using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Notifications;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Itinerary.DeleteActivity;

public class DeleteActivityHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<DeleteActivityCommand, bool>
{
    public async Task<bool> Handle(DeleteActivityCommand command, CancellationToken cancellationToken)
    {
        // F08: load then remove so the aggregate raises ActivityRemovedDomainEvent for the read-model
        // projector (the outbox interceptor captures it in the same transaction).
        var activity = await db.Activities
            .FirstOrDefaultAsync(a => a.Id == command.Id && a.TripId == command.TripId, cancellationToken);
        if (activity is null)
        {
            return false;
        }

        activity.Remove();

        // F20: notify the trip's other members (same transaction via the outbox).
        var notification = await TripNotifications.BuildAsync(
            db, command.TripId, command.ActorUserId, NotificationKind.ActivityRemoved, activity.Name, cancellationToken);
        if (notification is not null) db.OutboxMessages.Add(notification);

        db.Activities.Remove(activity);
        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "activity.deleted", cancellationToken);
        return true;
    }
}
