using System.Text.Json;
using Explivio.NotificationsWorker.Consuming.Contracts;

namespace Explivio.NotificationsWorker.Consuming;

// F07: routes a domain-event message to a handler by its Service Bus Subject (the event type name).
// Kept free of Service Bus and database types so the routing is unit-testable on its own. For now
// the handlers just log the notification they would send — real in-app / mobile push delivery lands
// in F20.
public sealed class DomainEventDispatcher(ILogger<DomainEventDispatcher> logger)
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    // Returns true when a handler matched the subject, false when the event was ignored.
    public bool Dispatch(string? subject, BinaryData body)
    {
        switch (subject)
        {
            case nameof(TripCreatedDomainEvent):
                var trip = body.ToObjectFromJson<TripCreatedDomainEvent>(SerializerOptions);
                logger.LogInformation(
                    "Notifications worker would notify user {UserId} that their trip to {Destination} (trip {TripId}) was created. Real delivery lands in F20.",
                    trip?.UserId, trip?.Destination, trip?.TripId);
                return true;

            default:
                logger.LogWarning("No handler registered for event subject '{Subject}'; ignoring.", subject);
                return false;
        }
    }
}
