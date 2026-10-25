using Explivio.Messaging;
using Explivio.NotificationsWorker.Consuming.Contracts;

namespace Explivio.NotificationsWorker.Consuming;

// F20: turns one TripNotificationRaised event into the notification rows to persist — one per
// recipient. Pure (no DB / Service Bus), so the fan-out is unit-testable on its own; the processor
// adds the returned rows to the DbContext for the inbox transaction to commit.
public static class NotificationFactory
{
    public static IReadOnlyList<Notification> Build(TripNotificationRaised evt, DateTime createdAtUtc)
    {
        return evt.RecipientUserIds
            .Distinct()
            .Select(recipientId => new Notification
            {
                Id = Guid.NewGuid(),
                UserId = recipientId,
                TripId = evt.TripId,
                TripName = evt.TripName,
                Kind = evt.Kind,
                Detail = evt.Detail,
                ActorUserId = evt.ActorUserId,
                CreatedAt = createdAtUtc,
                IsRead = false,
            })
            .ToList();
    }
}
