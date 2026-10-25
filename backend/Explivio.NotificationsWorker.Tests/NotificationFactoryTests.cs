using Explivio.NotificationsWorker.Consuming;
using Explivio.NotificationsWorker.Consuming.Contracts;
using Xunit;

namespace Explivio.NotificationsWorker.Tests;

// F20: the fan-out from one notification event to the rows persisted — one per recipient, with the
// event's fields copied onto each row.
public sealed class NotificationFactoryTests
{
    [Fact]
    public void Build_creates_one_row_per_recipient_with_event_fields()
    {
        var tripId = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var r1 = Guid.NewGuid();
        var r2 = Guid.NewGuid();
        var when = new DateTime(2026, 11, 1, 9, 0, 0, DateTimeKind.Utc);
        var evt = new TripNotificationRaised(tripId, "Lisbon Getaway", actor, [r1, r2], "ActivityAdded", "Belem Tower");

        var rows = NotificationFactory.Build(evt, when);

        Assert.Equal(2, rows.Count);
        Assert.Equal([r1, r2], rows.Select(n => n.UserId).ToArray());
        Assert.All(rows, n =>
        {
            Assert.Equal(tripId, n.TripId);
            Assert.Equal("Lisbon Getaway", n.TripName);
            Assert.Equal(actor, n.ActorUserId);
            Assert.Equal("ActivityAdded", n.Kind);
            Assert.Equal("Belem Tower", n.Detail);
            Assert.Equal(when, n.CreatedAt);
            Assert.False(n.IsRead);
            Assert.NotEqual(Guid.Empty, n.Id);
        });
    }

    [Fact]
    public void Build_deduplicates_repeated_recipients()
    {
        var r = Guid.NewGuid();
        var evt = new TripNotificationRaised(Guid.NewGuid(), "Trip", Guid.NewGuid(), [r, r], "ExpenseAdded", null);

        var rows = NotificationFactory.Build(evt, DateTime.UtcNow);

        Assert.Single(rows);
    }

    [Fact]
    public void Build_with_no_recipients_creates_nothing()
    {
        var evt = new TripNotificationRaised(Guid.NewGuid(), "Trip", Guid.NewGuid(), [], "StatusChanged", "Active");

        Assert.Empty(NotificationFactory.Build(evt, DateTime.UtcNow));
    }
}
