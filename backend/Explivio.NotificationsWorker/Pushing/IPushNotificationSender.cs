namespace Explivio.NotificationsWorker.Pushing;

// F20 (push): sends a push notification to a set of device tokens. Abstracted so the worker processor
// doesn't depend on the transport (Expo today) and stays unit-testable, and so push can be switched off
// by registering the no-op implementation. Returns the tokens the transport reported as permanently
// invalid (e.g. Expo's DeviceNotRegistered) so the caller can prune them.
public interface IPushNotificationSender
{
    Task<IReadOnlyCollection<string>> SendAsync(
        IReadOnlyCollection<string> tokens,
        string title,
        string body,
        IReadOnlyDictionary<string, string> data,
        CancellationToken cancellationToken);
}
