namespace Explivio.NotificationsWorker.Consuming.Contracts;

// F20: the worker's local copy of the notification event published by Explivio.API. Matched by the
// Service Bus Subject (the type name), so the name and property names must stay in sync with the
// publisher. RecipientUserIds already excludes the actor; the worker writes one row per recipient.
public sealed record TripNotificationRaised(
    Guid TripId,
    string TripName,
    Guid ActorUserId,
    Guid[] RecipientUserIds,
    string Kind,
    string? Detail);
