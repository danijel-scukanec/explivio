using Azure.Messaging.ServiceBus;
using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.Outbox;

// F05: drains the outbox to Service Bus. Every tick it publishes a batch of unprocessed messages
// to the 'domain-events' topic and stamps them processed. The outbox row id becomes the Service
// Bus MessageId so downstream consumers (F06/F07) can dedupe. A publish failure is recorded on the
// row and left unprocessed, so it is retried on the next tick (at-least-once delivery).
public sealed class OutboxProcessor(
    IServiceScopeFactory scopeFactory,
    ServiceBusClient serviceBusClient,
    ILogger<OutboxProcessor> logger) : BackgroundService
{
    private const string TopicName = "domain-events";
    private const int BatchSize = 20;
    private static readonly TimeSpan PollingInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var sender = serviceBusClient.CreateSender(TopicName);
        using var timer = new PeriodicTimer(PollingInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishPendingAsync(sender, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Outbox processing tick failed.");
            }

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task PublishPendingAsync(ServiceBusSender sender, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var messages = await db.Set<OutboxMessage>()
            .Where(m => m.ProcessedOnUtc == null)
            .OrderBy(m => m.OccurredOnUtc)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        if (messages.Count == 0)
        {
            return;
        }

        foreach (var message in messages)
        {
            try
            {
                var serviceBusMessage = new ServiceBusMessage(message.Content)
                {
                    MessageId = message.Id.ToString(),
                    Subject = message.Type,
                    ContentType = "application/json",
                };

                await sender.SendMessageAsync(serviceBusMessage, cancellationToken);
                message.ProcessedOnUtc = DateTime.UtcNow;
                message.Error = null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Failed to publish outbox message {MessageId}.", message.Id);
                message.Error = ex.Message;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
