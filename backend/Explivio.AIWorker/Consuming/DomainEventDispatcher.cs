using System.Text.Json;
using Explivio.AIWorker.Consuming.Contracts;

namespace Explivio.AIWorker.Consuming;

// F06: routes a domain-event message to a handler by its Service Bus Subject (the event type name).
// Kept free of Service Bus and database types so the routing is unit-testable on its own. For now
// the handlers just log — the actual AI generation on TripCreated lands in F12.
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
                    "AI worker received TripCreated for trip {TripId} to {Destination} (user {UserId}). AI itinerary generation lands in F12.",
                    trip?.TripId, trip?.Destination, trip?.UserId);
                return true;

            default:
                logger.LogWarning("No handler registered for event subject '{Subject}'; ignoring.", subject);
                return false;
        }
    }
}
