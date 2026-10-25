namespace Explivio.API.Modules.Notifications;

// F20: the notification integration event. Built at a mutation site once the acting user and the
// trip's other members are known (not an aggregate domain event — aggregates don't know the
// membership). It travels through the outbox to the Notifications Worker, which fans it out into one
// Notification row per recipient. RecipientUserIds already excludes the actor, so the worker writes
// rows verbatim.
public sealed record TripNotificationRaised(
    Guid TripId,
    string TripName,
    Guid ActorUserId,
    IReadOnlyList<Guid> RecipientUserIds,
    string Kind,
    string? Detail);

// The kinds of trip change that notify other members. Serialized to the notification row as a string.
public enum NotificationKind
{
    ActivityAdded,
    ActivityRemoved,
    ExpenseAdded,
    ExpenseRemoved,
    StatusChanged,
}
