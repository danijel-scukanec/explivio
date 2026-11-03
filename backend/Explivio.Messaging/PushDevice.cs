namespace Explivio.Messaging;

// F20 (push): a registered device that can receive push notifications for a user. Like Notification,
// the table lives in the API-owned "read" schema — the API migrates it and owns the register/unregister
// endpoints; the Notifications Worker reads tokens from it (mapped ExcludeFromMigrations on its side) to
// send push alongside writing the in-app rows. Defined here, in the library both projects reference, so
// they agree on the table's shape.
public class PushDevice
{
    public Guid Id { get; set; }

    // The user this device belongs to (the notification recipient).
    public Guid UserId { get; set; }

    // The Expo push token (ExponentPushToken[...]). Unique: a physical device has one, and on
    // re-registration (new user on the same device, or a refreshed token) we upsert by this value.
    public string ExpoPushToken { get; set; } = string.Empty;

    // "android" | "ios" — informational, for future per-platform handling.
    public string Platform { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    // Bumped on each re-register, so a future sweep can prune devices that stopped checking in.
    public DateTime LastSeenAt { get; set; }
}
