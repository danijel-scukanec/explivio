using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Explivio.API.Modules.Budget;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Trips;
using Explivio.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.ReadModel;

// F08: keeps the TripSummary read model current. The Service Bus pumping and inbox dedupe live in the
// shared InboxProcessor; this class supplies the 'read-model' subscription and the projection logic.
// Because the projector mutates the supplied ReadDbContext and the base saves those changes together
// with the inbox row, the projection and the dedupe record commit in one transaction — the
// exactly-once guarantee for the non-idempotent counts and sums. Hosted inside the API because the
// API owns the read model it serves.
public sealed class TripSummaryProjector(
    ServiceBusClient client,
    IServiceScopeFactory scopeFactory,
    ILogger<TripSummaryProjector> logger)
    : InboxProcessor<ReadDbContext, ProjectionInboxMessage>(client, scopeFactory, logger)
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    protected override string SubscriptionName => "read-model";
    protected override string ConsumerName => "Trip summary projector";

    protected override async Task HandleAsync(
        ReadDbContext db, string? subject, BinaryData body, CancellationToken cancellationToken)
    {
        switch (subject)
        {
            case nameof(TripCreatedDomainEvent):
                var created = Deserialize<TripCreatedDomainEvent>(body);
                db.TripSummaries.Add(TripSummaryProjection.Create(created));
                break;

            case nameof(TripStopsChangedDomainEvent):
                var stopsChanged = Deserialize<TripStopsChangedDomainEvent>(body);
                await MutateAsync(db, stopsChanged.TripId, s => TripSummaryProjection.ApplyStopsChanged(s, stopsChanged.Destination), subject, cancellationToken);
                break;

            case nameof(ActivityAddedDomainEvent):
                var added = Deserialize<ActivityAddedDomainEvent>(body);
                await MutateAsync(db, added.TripId, TripSummaryProjection.ApplyActivityAdded, subject, cancellationToken);
                break;

            case nameof(ActivityRemovedDomainEvent):
                var removed = Deserialize<ActivityRemovedDomainEvent>(body);
                await MutateAsync(db, removed.TripId, TripSummaryProjection.ApplyActivityRemoved, subject, cancellationToken);
                break;

            case nameof(ExpenseAddedDomainEvent):
                var expense = Deserialize<ExpenseAddedDomainEvent>(body);
                await MutateAsync(db, expense.TripId, s => TripSummaryProjection.ApplyExpenseAdded(s, expense.Amount), subject, cancellationToken);
                break;

            case nameof(TripDeletedDomainEvent):
                var deleted = Deserialize<TripDeletedDomainEvent>(body);
                var toRemove = await db.TripSummaries.FirstOrDefaultAsync(s => s.TripId == deleted.TripId, cancellationToken);
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
}
