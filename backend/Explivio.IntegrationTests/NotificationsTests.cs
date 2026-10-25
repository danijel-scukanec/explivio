using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F20: in-app notifications. The read endpoints are tested by seeding notification rows directly (the
// Notifications Worker that writes them needs the Service Bus broker, which the test factory doesn't
// run — that path is verified live). The publish half is tested through the real pipeline: a mutation
// on a shared trip writes a TripNotificationRaised outbox row targeting the other members.
public sealed class NotificationsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static Guid DevUser => ExplivioApiFactory.DevUserId;

    [Fact]
    public async Task Feed_returns_only_my_notifications_with_the_unread_count()
    {
        var ct = TestContext.Current.CancellationToken;
        // A unique user, so the feed is isolated from other tests sharing this database.
        var mine = Guid.NewGuid();
        var other = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await SeedAsync(ct,
            Notif(mine, tripId, "ActivityAdded", isRead: false, when: new DateTime(2026, 11, 1, 10, 0, 0, DateTimeKind.Utc)),
            Notif(mine, tripId, "ExpenseAdded", isRead: false, when: new DateTime(2026, 11, 2, 10, 0, 0, DateTimeKind.Utc)),
            Notif(mine, tripId, "StatusChanged", isRead: true, when: new DateTime(2026, 11, 3, 10, 0, 0, DateTimeKind.Utc)),
            Notif(other, tripId, "ActivityAdded", isRead: false, when: DateTime.UtcNow));

        var feed = await GetFeedAsync(mine, ct);

        Assert.Equal(3, feed.Items.Count);           // not the other user's
        Assert.Equal(2, feed.UnreadCount);
        Assert.Equal("StatusChanged", feed.Items[0].Kind); // newest first
    }

    [Fact]
    public async Task Mark_read_flips_one_and_a_foreign_notification_is_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();
        var mineId = Guid.NewGuid();
        var foreignId = Guid.NewGuid();
        await SeedAsync(ct,
            Notif(me, Guid.NewGuid(), "ActivityAdded", isRead: false, id: mineId),
            Notif(Guid.NewGuid(), Guid.NewGuid(), "ActivityAdded", isRead: false, id: foreignId));

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsAsync(me, HttpMethod.Post, $"/v1/notifications/{mineId}/read", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsAsync(me, HttpMethod.Post, $"/v1/notifications/{foreignId}/read", ct)).StatusCode);

        var feed = await GetFeedAsync(me, ct);
        Assert.Equal(0, feed.UnreadCount);

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsAsync(me, HttpMethod.Post, "/v1/notifications/read-all", ct)).StatusCode);
    }

    private async Task<FeedDto> GetFeedAsync(Guid user, CancellationToken ct)
    {
        var res = await SendAsAsync(user, HttpMethod.Get, "/v1/notifications", ct);
        return (await res.Content.ReadFromJsonAsync<FeedDto>(ct))!;
    }

    private Task<HttpResponseMessage> SendAsAsync(Guid user, HttpMethod method, string path, CancellationToken ct)
    {
        var req = new HttpRequestMessage(method, path);
        req.Headers.Add("X-Dev-User", user.ToString());
        return _client.SendAsync(req, ct);
    }

    [Fact]
    public async Task Adding_an_activity_on_a_shared_trip_publishes_a_notification_for_the_other_member()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);          // owner = DevUser
        var memberB = Guid.NewGuid();
        await AddMemberAsync(tripId, memberB, "Editor", ct);

        // DevUser (owner) adds an activity → member B should be notified.
        var add = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/activities", new
        {
            name = "Belem Tower", date = "2026-11-01", category = "Sightseeing",
        }, ct);
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);

        var evt = await LatestNotificationOutboxAsync(tripId, ct);
        Assert.NotNull(evt);
        Assert.Equal("ActivityAdded", evt!.Kind);
        Assert.Contains(memberB, evt.RecipientUserIds);
        Assert.DoesNotContain(DevUser, evt.RecipientUserIds); // the actor isn't notified
    }

    [Fact]
    public async Task Adding_an_activity_on_a_solo_trip_publishes_no_notification()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);          // only member is the owner

        await _client.PostAsJsonAsync($"/v1/trips/{tripId}/activities", new
        {
            name = "Solo walk", date = "2026-11-01", category = "Sightseeing",
        }, ct);

        Assert.Null(await LatestNotificationOutboxAsync(tripId, ct));
    }

    private static Notification Notif(
        Guid userId, Guid tripId, string kind, bool isRead, DateTime? when = null, Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        UserId = userId,
        TripId = tripId,
        TripName = "Lisbon Getaway",
        Kind = kind,
        Detail = null,
        ActorUserId = Guid.NewGuid(),
        CreatedAt = when ?? DateTime.UtcNow,
        IsRead = isRead,
    };

    private async Task SeedAsync(CancellationToken ct, params Notification[] rows)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
        db.Notifications.AddRange(rows);
        await db.SaveChangesAsync(ct);
    }

    // The most recent TripNotificationRaised outbox row for a trip, or null if none was published.
    private async Task<TripNotificationDto?> LatestNotificationOutboxAsync(Guid tripId, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var contents = await db.OutboxMessages
            .Where(m => m.Type == "TripNotificationRaised")
            .OrderByDescending(m => m.OccurredOnUtc)
            .Select(m => m.Content)
            .ToListAsync(ct);
        return contents
            .Select(c => JsonSerializer.Deserialize<TripNotificationDto>(c, Web))
            .FirstOrDefault(e => e!.TripId == tripId);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Notif Trip", startDate = "2026-11-01", endDate = "2026-11-03",
            travelerCount = 2, stops = new[] { new { place = "Lisbon" } }, userId = ExplivioApiFactory.DevUserId,
        }, ct);
        return (await create.Content.ReadFromJsonAsync<CreatedDto>(ct))!.Id;
    }

    private async Task AddMemberAsync(Guid tripId, Guid userId, string role, CancellationToken ct)
    {
        var res = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/members", new { userId, role }, ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record FeedItemDto(Guid Id, Guid TripId, string TripName, string Kind, bool IsRead);
    private sealed record FeedDto(int UnreadCount, List<FeedItemDto> Items);
    private sealed record TripNotificationDto(Guid TripId, string Kind, Guid[] RecipientUserIds);
}
