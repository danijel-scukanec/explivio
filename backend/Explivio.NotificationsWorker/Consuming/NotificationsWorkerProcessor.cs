using Azure.Messaging.ServiceBus;
using Explivio.Messaging;
using Explivio.NotificationsWorker.Inbox;

namespace Explivio.NotificationsWorker.Consuming;

// F07: the notifications worker's consumer. All the Service Bus pumping and inbox dedupe live in the
// shared InboxProcessor; this class supplies only the subscription, a log name, and what to do with
// each event. Handling is log-only for now (the DbContext is used solely for dedupe) — real in-app /
// mobile push delivery lands in F20.
public sealed class NotificationsWorkerProcessor(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    DomainEventDispatcher dispatcher,
    ILogger<NotificationsWorkerProcessor> logger)
    : InboxProcessor<NotificationsDbContext, InboxMessage>(client, scopeFactory, logger)
{
    protected override string SubscriptionName => "notifications-worker";
    protected override string ConsumerName => "Notifications worker";

    protected override Task HandleAsync(
        NotificationsDbContext db, string? subject, BinaryData body, CancellationToken cancellationToken)
    {
        dispatcher.Dispatch(subject, body);
        return Task.CompletedTask;
    }
}
