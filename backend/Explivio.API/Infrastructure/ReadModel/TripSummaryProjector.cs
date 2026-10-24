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
                // F26: keep the gallery row's destination in step too (if the trip is in the gallery).
                var pop = await db.TripPopularity.FirstOrDefaultAsync(p => p.TripId == stopsChanged.TripId, cancellationToken);
                if (pop is not null)
                {
                    TripPopularityProjection.ApplyStopsChanged(pop, stopsChanged.Destination);
                }
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
                var popToRemove = await db.TripPopularity.FirstOrDefaultAsync(p => p.TripId == deleted.TripId, cancellationToken);
                if (popToRemove is not null)
                {
                    db.TripPopularity.Remove(popToRemove);
                }
                break;

            // F26: the gallery / like read model. Published carries the trip's denormalized state, so
            // the gallery row is built (or refreshed) from the event; the rest mutate an existing row.
            case nameof(TripPublishedDomainEvent):
                var published = Deserialize<TripPublishedDomainEvent>(body);
                var existing = await db.TripPopularity.FirstOrDefaultAsync(p => p.TripId == published.TripId, cancellationToken);
                var row = TripPopularityProjection.Publish(existing, published);
                if (existing is null)
                {
                    db.TripPopularity.Add(row);
                }
                break;

            case nameof(TripUnpublishedDomainEvent):
                var unpublished = Deserialize<TripUnpublishedDomainEvent>(body);
                await MutatePopularityAsync(db, unpublished.TripId, TripPopularityProjection.Unpublish, subject, cancellationToken);
                break;

            case nameof(TripLikedDomainEvent):
                var liked = Deserialize<TripLikedDomainEvent>(body);
                await MutatePopularityAsync(db, liked.TripId, TripPopularityProjection.ApplyLiked, subject, cancellationToken);
                break;

            case nameof(TripUnlikedDomainEvent):
                var unliked = Deserialize<TripUnlikedDomainEvent>(body);
                await MutatePopularityAsync(db, unliked.TripId, TripPopularityProjection.ApplyUnliked, subject, cancellationToken);
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

    // F26: same skip-if-missing posture as MutateAsync, for the gallery read model.
    private async Task MutatePopularityAsync(
        ReadDbContext db, Guid tripId, Action<TripPopularity> mutate, string? subject, CancellationToken ct)
    {
        var row = await db.TripPopularity.FirstOrDefaultAsync(p => p.TripId == tripId, ct);
        if (row is null)
        {
            logger.LogWarning("No TripPopularity for trip {TripId} when projecting {Subject}; skipping.", tripId, subject);
            return;
        }

        mutate(row);
    }

    private static T Deserialize<T>(BinaryData body) => body.ToObjectFromJson<T>(SerializerOptions)!;
}
