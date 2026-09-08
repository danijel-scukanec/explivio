using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Explivio.API.Modules.Budget;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Trips;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.ReadModel;

// F08: keeps the TripSummary read model current. It subscribes to the 'domain-events' topic through
// its own 'read-model' subscription and, for each event, updates the read model AND records the
// message in the projection inbox within a single transaction — so a redelivery can't double-count.
// Messages are completed explicitly (AutoComplete off) so a failure is redelivered and eventually
// dead-lettered. Hosted inside the API because the API owns the read model it serves.
public sealed class TripSummaryProjector(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    ILogger<TripSummaryProjector> logger) : BackgroundService
{
    private const string TopicName = "domain-events";
    private const string SubscriptionName = "read-model";
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

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
        logger.LogInformation("Trip summary projector listening on {Topic}/{Subscription}.", TopicName, SubscriptionName);

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
        var db = scope.ServiceProvider.GetRequiredService<ReadDbContext>();

        // Inbox dedupe: already projected → acknowledge and move on.
        if (await db.InboxMessages.AnyAsync(m => m.MessageId == messageId, ct))
        {
            logger.LogInformation("Skipping already-projected message {MessageId} ({Subject}).", messageId, subject);
            await args.CompleteMessageAsync(args.Message, ct);
            return;
        }

        await ProjectAsync(db, subject, args.Message.Body, ct);

        db.InboxMessages.Add(new ProjectionInboxMessage
        {
            MessageId = messageId,
            Subject = subject ?? string.Empty,
            ProcessedOnUtc = DateTime.UtcNow,
        });

        try
        {
            // The projection change and the inbox row commit together — the exactly-once guarantee.
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // A concurrent redelivery projected the same message first — safe to treat as handled.
            logger.LogInformation("Message {MessageId} was projected concurrently; treating as duplicate.", messageId);
        }

        await args.CompleteMessageAsync(args.Message, ct);
    }

    private async Task ProjectAsync(ReadDbContext db, string? subject, BinaryData body, CancellationToken ct)
    {
        switch (subject)
        {
            case nameof(TripCreatedDomainEvent):
                var created = Deserialize<TripCreatedDomainEvent>(body);
                db.TripSummaries.Add(TripSummaryProjection.Create(created));
                break;

            case nameof(ActivityAddedDomainEvent):
                var added = Deserialize<ActivityAddedDomainEvent>(body);
                await MutateAsync(db, added.TripId, TripSummaryProjection.ApplyActivityAdded, subject, ct);
                break;

            case nameof(ActivityRemovedDomainEvent):
                var removed = Deserialize<ActivityRemovedDomainEvent>(body);
                await MutateAsync(db, removed.TripId, TripSummaryProjection.ApplyActivityRemoved, subject, ct);
                break;

            case nameof(ExpenseAddedDomainEvent):
                var expense = Deserialize<ExpenseAddedDomainEvent>(body);
                await MutateAsync(db, expense.TripId, s => TripSummaryProjection.ApplyExpenseAdded(s, expense.Amount), subject, ct);
                break;

            case nameof(TripDeletedDomainEvent):
                var deleted = Deserialize<TripDeletedDomainEvent>(body);
                var toRemove = await db.TripSummaries.FirstOrDefaultAsync(s => s.TripId == deleted.TripId, ct);
                if (toRemove is not null)
                {
                    db.TripSummaries.Remove(toRemove);
                }
                break;

            default:
                logger.LogWarning("No projection for event subject '{Subject}'; ignoring.", subject);
                break;
        }
    }

    private async Task MutateAsync(
        ReadDbContext db, Guid tripId, Action<TripSummary> mutate, string? subject, CancellationToken ct)
    {
        var summary = await db.TripSummaries.FirstOrDefaultAsync(s => s.TripId == tripId, ct);
        if (summary is null)
        {
            // The trip's summary hasn't been projected yet (out-of-order delivery) or was deleted.
            // Skip rather than fabricate a partial row; the event is still recorded in the inbox.
            logger.LogWarning("No TripSummary for trip {TripId} when projecting {Subject}; skipping.", tripId, subject);
            return;
        }

        mutate(summary);
    }

    private static T Deserialize<T>(BinaryData body) => body.ToObjectFromJson<T>(SerializerOptions)!;

    private Task OnErrorAsync(ProcessErrorEventArgs args)
    {
        logger.LogError(args.Exception, "Error projecting Service Bus message from {Source}.", args.ErrorSource);
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
