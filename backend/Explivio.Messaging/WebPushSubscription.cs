namespace Explivio.Messaging;

// F20 (web push): a browser Web Push subscription that can receive push for a user. The web client's
// PushManager.subscribe() yields an endpoint plus two keys (p256dh + auth) used to encrypt the payload;
// together they are the "token" for one browser profile. Like PushDevice, the table lives in the
// API-owned "read" schema — the API migrates it and owns the register/unregister endpoints; the
// Notifications Worker reads subscriptions from it (mapped ExcludeFromMigrations on its side) to send
// web push alongside the Expo push and the in-app rows. Kept separate from PushDevice because the
// natural key (the endpoint URL) and shape differ from an Expo token — each transport stays isolated.
public class WebPushSubscription
{
    public Guid Id { get; set; }

    // The user this subscription belongs to (the notification recipient).
    public Guid UserId { get; set; }

    // The push service endpoint URL (unique per browser profile). On re-subscribe with the same
    // endpoint we upsert by this value rather than inserting a duplicate.
    public string Endpoint { get; set; } = string.Empty;

    // The subscription's public key (ECDH P-256), base64url — used to encrypt the payload to this browser.
    public string P256dh { get; set; } = string.Empty;

    // The subscription's auth secret, base64url — the second half of the payload encryption input.
    public string Auth { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    // Bumped on each re-subscribe, so a future sweep can prune subscriptions that stopped checking in.
    public DateTime LastSeenAt { get; set; }
}
