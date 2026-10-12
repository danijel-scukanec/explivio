using Azure.Messaging.ServiceBus;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Explivio.Messaging;

// Shared message pump for the domain-event consumers (the AI worker, the notifications worker and
// the read-model projector). It subscribes to the 'domain-events' topic through a consumer-specific
// subscription and, for each message, dedupes against the consumer's inbox before handing off to
// HandleAsync, then records the message in the inbox. Messages are completed explicitly (AutoComplete
// off) so a failure leaves the message for Service Bus to redeliver, and eventually dead-letter once
// MaxDeliveryCount is exceeded.
//
// A subclass supplies only its subscription name, a display name for logs, and the handling logic.
// Log-only consumers ignore the supplied DbContext (using it solely for inbox dedupe); the read-model
// projector mutates it, and because the handler's changes and the inbox row are saved together, the
// projection is effectively exactly-once even though it isn't idempotent.
public abstract class InboxProcessor<TDbContext, TInbox>(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    ILogger logger) : BackgroundService
    where TDbContext : DbContext
    where TInbox : class, IInboxMessage, new()
{
    private const string TopicName = "domain-events";

    private ServiceBusProcessor? processor;

    // The Service Bus subscription this consumer reads from.
    protected abstract string SubscriptionName { get; }

    // A human-readable name for this consumer, used only in log messages.
    protected abstract string ConsumerName { get; }

    // Handles one domain event. `db` is a fresh scoped context; an implementation that mutates it
    // must NOT call SaveChanges itself — the pump saves the handler's changes together with the
    // inbox row so the two commit atomically.
    protected abstract Task HandleAsync(
        TDbContext db, string? subject, BinaryData body, CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        processor = client.CreateProcessor(TopicName, SubscriptionName, new ServiceBusProcessorOptions
        {
            MaxConcurrentCalls = 1,
            AutoCompleteMessages = false,
        });

        processor.ProcessMessageAsync += OnMessageAsync;
        processor.ProcessErrorAsync += OnErrorAsync;

        await processor.StartProcessingAsync(stoppingToken);
        logger.LogInformation("{Consumer} listening on {Topic}/{Subscription}.", ConsumerName, TopicName, SubscriptionName);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }

        await processor.StopProcessingAsync(CancellationToken.None);
    }

    private async Task OnMessageAsync(ProcessMessageEventArgs args)
    {
        var messageId = args.Message.MessageId;
        var subject = args.Message.Subject;
        var ct = args.CancellationToken;

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TDbContext>();

        // Inbox dedupe: if we've already recorded this message, acknowledge and move on.
        if (await db.Set<TInbox>().AnyAsync(m => m.MessageId == messageId, ct))
        {
            logger.LogInformation(
                "{Consumer} skipping already-processed message {MessageId} ({Subject}).", ConsumerName, messageId, subject);
            await args.CompleteMessageAsync(args.Message, ct);
            return;
        }

        await HandleAsync(db, subject, args.Message.Body, ct);

        db.Set<TInbox>().Add(new TInbox
        {
            MessageId = messageId,
            Subject = subject ?? string.Empty,
            ProcessedOnUtc = DateTime.UtcNow,
        });

        try
        {
            // Any changes the handler made and the inbox row commit together.
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // A concurrent redelivery recorded the same inbox row first — that's fine, it's handled.
            logger.LogInformation(
                "{Consumer} saw message {MessageId} processed concurrently; treating as duplicate.", ConsumerName, messageId);
        }

        await args.CompleteMessageAsync(args.Message, ct);
    }

    private Task OnErrorAsync(ProcessErrorEventArgs args)
    {
        logger.LogError(
            args.Exception, "{Consumer} error handling Service Bus message from {Source}.", ConsumerName, args.ErrorSource);
        return Task.CompletedTask;
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (processor is not null)
        {
            await processor.DisposeAsync();
        }

        await base.StopAsync(cancellationToken);
    }
}
