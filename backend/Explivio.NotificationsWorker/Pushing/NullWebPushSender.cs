using Explivio.Messaging;

namespace Explivio.NotificationsWorker.Pushing;

// F20 (web push): the no-op sender, registered when web push is disabled (PushNotifications:Enabled is
// false, or no VAPID keys configured). Keeps the processor's dependency always satisfiable — including
// in integration tests, which host the worker with push off — so the in-app path runs unchanged.
public sealed class NullWebPushSender : IWebPushSender
{
    public Task<IReadOnlyCollection<string>> SendAsync(
        IReadOnlyCollection<WebPushSubscription> subscriptions,
        string title,
        string body,
        IReadOnlyDictionary<string, string> data,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyCollection<string>>([]);
}
