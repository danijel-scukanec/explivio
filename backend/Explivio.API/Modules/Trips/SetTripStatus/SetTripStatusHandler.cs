using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using Explivio.API.Modules.Notifications;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.SetTripStatus;

public class SetTripStatusHandler(AppDbContext db) : IRequestHandler<SetTripStatusCommand, Result>
{
    public async Task<Result> Handle(SetTripStatusCommand command, CancellationToken cancellationToken)
    {
        var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == command.TripId, cancellationToken);
        if (trip is null)
            return Error.NotFound("Trip.NotFound", $"No trip with id '{command.TripId}' was found.");

        trip.SetStatus(command.Status);

        // F20: notify the trip's other members (published via the outbox in the same transaction).
        var notification = await TripNotifications.BuildAsync(
            db, command.TripId, command.ActorUserId, NotificationKind.StatusChanged, command.Status.ToString(), cancellationToken);
        if (notification is not null) db.OutboxMessages.Add(notification);

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
