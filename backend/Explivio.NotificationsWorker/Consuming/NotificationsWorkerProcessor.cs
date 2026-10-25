using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Explivio.Messaging;
using Explivio.NotificationsWorker.Consuming.Contracts;
using Explivio.NotificationsWorker.Inbox;

namespace Explivio.NotificationsWorker.Consuming;

// F07/F20: the notifications worker's consumer. All the Service Bus pumping and inbox dedupe live in
// the shared InboxProcessor; this class supplies only the subscription, a log name, and what to do
// with each event. TripNotificationRaised (F20) is fanned out into in-app notification rows — added
// to the DbContext so the base saves them together with the inbox row (exactly-once). Other events
// are still log-only via the dispatcher.
public sealed class NotificationsWorkerProcessor(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    DomainEventDispatcher dispatcher,
    ILogger<NotificationsWorkerProcessor> logger)
    : InboxProcessor<NotificationsDbContext, InboxMessage>(client, scopeFactory, logger)
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    protected override string SubscriptionName => "notifications-worker";
    protected override string ConsumerName => "Notifications worker";

    protected override Task HandleAsync(
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
            }
            return Task.CompletedTask;
        }

        dispatcher.Dispatch(subject, body);
        return Task.CompletedTask;
    }
}
