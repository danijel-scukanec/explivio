using Azure.Messaging.ServiceBus;
using Explivio.AIWorker.Inbox;
using Explivio.Messaging;

namespace Explivio.AIWorker.Consuming;

// F06: the AI worker's consumer. All the Service Bus pumping and inbox dedupe live in the shared
// InboxProcessor; this class supplies only the subscription, a log name, and what to do with each
// event. Handling is log-only for now (the DbContext is used solely for dedupe) — the actual AI
// work this worker will own is future scope.
public sealed class AiWorkerProcessor(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    DomainEventDispatcher dispatcher,
    ILogger<AiWorkerProcessor> logger)
    : InboxProcessor<WorkerDbContext, InboxMessage>(client, scopeFactory, logger)
{
    protected override string SubscriptionName => "ai-worker";
    protected override string ConsumerName => "AI worker";

    protected override Task HandleAsync(
        WorkerDbContext db, string? subject, BinaryData body, CancellationToken cancellationToken)
    {
        dispatcher.Dispatch(subject, body);
        return Task.CompletedTask;
    }
}
