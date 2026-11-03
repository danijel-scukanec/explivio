namespace Explivio.NotificationsWorker.Pushing;

// F20 (push): the no-op sender, registered when push is disabled (PushNotifications:Enabled is false
// or no Expo config). Keeps the processor's dependency always satisfiable — including in integration
// tests, which host the worker with push off — so the in-app path runs unchanged.
public sealed class NullPushSender : IPushNotificationSender
{
    public Task<IReadOnlyCollection<string>> SendAsync(
        IReadOnlyCollection<string> tokens,
        string title,
        string body,
        IReadOnlyDictionary<string, string> data,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyCollection<string>>([]);
}
