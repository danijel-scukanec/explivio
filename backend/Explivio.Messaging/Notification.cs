namespace Explivio.Messaging;

// F20: one in-app notification row. It's a read-model record written by the Notifications Worker
// (which consumes TripNotificationRaised events over Service Bus) and read by the API's notifications
// endpoints. The table lives in the API-owned "read" schema: the API migrates it, and the worker maps
// it ExcludeFromMigrations so only one side owns the schema. Defined here, in the library both
// Explivio.API and Explivio.NotificationsWorker reference, because both map the same physical table
// and must agree on its shape.
public class Notification
{
    public Guid Id { get; set; }

    // The user who should see this notification (a trip member other than the actor).
    public Guid UserId { get; set; }

    public Guid TripId { get; set; }
    public string TripName { get; set; } = string.Empty;

    // The kind of change, as a string (e.g. "ActivityAdded") — kept loose so the worker's contract
    // copy and the clients don't need a shared enum.
    public string Kind { get; set; } = string.Empty;

    // Optional human detail, e.g. the activity name, the expense amount, or the new status.
    public string? Detail { get; set; }

    // Who made the change. There are no real display names yet (auth is deferred), so clients show a
    // generic actor; the id is kept for when identities arrive.
    public Guid ActorUserId { get; set; }

    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
}
