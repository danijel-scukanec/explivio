using Explivio.Messaging;

namespace Explivio.NotificationsWorker.Pushing;

// F20 (web push): sends a push notification to a set of browser Web Push subscriptions. Parallel to
// IPushNotificationSender (Expo) but takes the full subscription (endpoint + keys) since web push
// encrypts a payload per subscription rather than posting opaque tokens to a batch API. Returns the
// endpoints the push service reported as permanently gone (HTTP 404/410) so the caller can prune them.
public interface IWebPushSender
{
    Task<IReadOnlyCollection<string>> SendAsync(
        IReadOnlyCollection<WebPushSubscription> subscriptions,
        string title,
        string body,
        IReadOnlyDictionary<string, string> data,
        CancellationToken cancellationToken);
}
