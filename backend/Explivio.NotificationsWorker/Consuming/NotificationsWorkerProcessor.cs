using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Explivio.Messaging;
using Explivio.NotificationsWorker.Consuming.Contracts;
using Explivio.NotificationsWorker.Inbox;
using Explivio.NotificationsWorker.Pushing;
using Microsoft.EntityFrameworkCore;

namespace Explivio.NotificationsWorker.Consuming;

// F07/F20: the notifications worker's consumer. All the Service Bus pumping and inbox dedupe live in
// the shared InboxProcessor; this class supplies only the subscription, a log name, and what to do
// with each event. TripNotificationRaised (F20) is fanned out into in-app notification rows — added
// to the DbContext so the base saves them together with the inbox row (exactly-once) — and, when push
// is enabled, also sent as a push to the recipients' registered devices. Other events are still
// log-only via the dispatcher.
public sealed class NotificationsWorkerProcessor(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    DomainEventDispatcher dispatcher,
    IPushNotificationSender pushSender,
    ILogger<NotificationsWorkerProcessor> logger)
    : InboxProcessor<NotificationsDbContext, InboxMessage>(client, scopeFactory, logger)
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    protected override string SubscriptionName => "notifications-worker";
    protected override string ConsumerName => "Notifications worker";

    protected override async Task HandleAsync(
        NotificationsDbContext db, string? subject, BinaryData body, CancellationToken cancellationToken)
    {
        if (subject == nameof(TripNotificationRaised))
        {
            var evt = body.ToObjectFromJson<TripNotificationRaised>(SerializerOptions);
            if (evt is not null)
            {
                var rows = NotificationFactory.Build(evt, DateTime.UtcNow);
                db.Notifications.AddRange(rows);
                logger.LogInformation(
                    "Notifications worker created {Count} notification(s) for trip {TripId} ({Kind}).",
                    rows.Count, evt.TripId, evt.Kind);

                await SendPushAsync(db, evt, cancellationToken);
            }
            return;
        }

        dispatcher.Dispatch(subject, body);
    }

    // Best-effort push to the recipients' registered devices. Runs before the pump commits the in-app
    // rows + inbox row, and with NullPushSender when push is off, so it's a no-op by default. Any
    // failure is swallowed — the in-app notification is the source of truth, and throwing here would
    // abort the inbox transaction and redeliver the message. Tokens Expo reports as DeviceNotRegistered
    // are marked for deletion, committing with the rest of the handler's changes. Push is at-least-once:
    // a rare concurrent redelivery can send a duplicate, which is acceptable for notifications.
    private async Task SendPushAsync(NotificationsDbContext db, TripNotificationRaised evt, CancellationToken ct)
    {
        try
        {
            var recipients = evt.RecipientUserIds;
            if (recipients.Length == 0) return;

            var tokens = await db.PushDevices
                .Where(d => recipients.Contains(d.UserId))
                .Select(d => d.ExpoPushToken)
                .ToListAsync(ct);
            if (tokens.Count == 0) return;

            var (title, pushBody) = PushMessageText.For(evt.TripName, evt.Kind, evt.Detail);
            var data = new Dictionary<string, string> { ["tripId"] = evt.TripId.ToString() };

            var invalid = await pushSender.SendAsync(tokens, title, pushBody, data, ct);
            if (invalid.Count > 0)
            {
                // Standalone delete (its own round trip, not the pump's SaveChanges) — pruning dead
                // tokens is idempotent and best-effort, so it needn't share the notification's commit.
                await db.PushDevices
                    .Where(d => invalid.Contains(d.ExpoPushToken))
                    .ExecuteDeleteAsync(ct);
                logger.LogInformation("Pruned {Count} unregistered push device(s).", invalid.Count);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Push send failed for trip {TripId}; in-app notification still delivered.", evt.TripId);
        }
    }
}
