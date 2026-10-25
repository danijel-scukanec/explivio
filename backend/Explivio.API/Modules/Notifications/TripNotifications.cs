using System.Text.Json;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Notifications;

// F20: builds the outbox message that notifies a trip's OTHER members of a change. The caller adds it
// to db.OutboxMessages so it publishes in the SAME transaction as the mutation — the change and its
// notification commit together. It's an integration event raised from the handler (not an aggregate
// domain event) because the recipients depend on membership the aggregate doesn't know about; writing
// the outbox row directly keeps Entity's event-raising encapsulated. Returns null when there's no one
// to notify (a solo trip, or the actor is the only member).
public static class TripNotifications
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static async Task<OutboxMessage?> BuildAsync(
        AppDbContext db, Guid tripId, Guid actorId, NotificationKind kind, string? detail, CancellationToken ct)
    {
        var recipients = await db.TripMembers
            .Where(m => m.TripId == tripId && m.UserId != actorId)
            .Select(m => m.UserId)
            .ToListAsync(ct);
        if (recipients.Count == 0) return null;

        var tripName = await db.Trips
            .Where(t => t.Id == tripId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(ct) ?? "a trip";

        var evt = new TripNotificationRaised(tripId, tripName, actorId, recipients, kind.ToString(), detail);
        return new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = nameof(TripNotificationRaised),
            Content = JsonSerializer.Serialize(evt, SerializerOptions),
            OccurredOnUtc = DateTime.UtcNow,
        };
    }
}
