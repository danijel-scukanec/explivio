using Azure.Messaging.ServiceBus;
using Explivio.AIWorker.Inbox;
using Microsoft.EntityFrameworkCore;

namespace Explivio.AIWorker.Consuming;

// F06: the worker's message pump. It subscribes to the 'domain-events' topic through the 'ai-worker'
// subscription and, for each message, dedupes against the inbox before dispatching. Messages are
// completed explicitly (AutoComplete off) so a failure leaves the message for Service Bus to
// redeliver, and eventually dead-letter once MaxDeliveryCount is exceeded.
public sealed class DomainEventProcessor(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    DomainEventDispatcher dispatcher,
    ILogger<DomainEventProcessor> logger) : BackgroundService
{
    private const string TopicName = "domain-events";
    private const string SubscriptionName = "ai-worker";

    private ServiceBusProcessor? processor;

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
        logger.LogInformation("AI worker listening on {Topic}/{Subscription}.", TopicName, SubscriptionName);

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

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();

        // Inbox dedupe: if we've already recorded this message, acknowledge and move on.
        if (await db.InboxMessages.AnyAsync(m => m.MessageId == messageId, args.CancellationToken))
        {
            logger.LogInformation("Skipping already-processed message {MessageId} ({Subject}).", messageId, subject);
            await args.CompleteMessageAsync(args.Message, args.CancellationToken);
            return;
        }

        dispatcher.Dispatch(subject, args.Message.Body);

        db.InboxMessages.Add(new InboxMessage
        {
            MessageId = messageId,
            Subject = subject ?? string.Empty,
            ProcessedOnUtc = DateTime.UtcNow,
        });

        try
        {
            await db.SaveChangesAsync(args.CancellationToken);
        }
        catch (DbUpdateException)
        {
            // A concurrent redelivery inserted the same inbox row first — that's fine, it's handled.
            logger.LogInformation("Message {MessageId} was processed concurrently; treating as duplicate.", messageId);
        }

        await args.CompleteMessageAsync(args.Message, args.CancellationToken);
    }

    private Task OnErrorAsync(ProcessErrorEventArgs args)
    {
        logger.LogError(args.Exception, "Error handling Service Bus message from {Source}.", args.ErrorSource);
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
