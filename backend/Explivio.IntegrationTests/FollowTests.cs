using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Social;
using Explivio.API.Modules.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F26 (follow): the social graph + its gallery/profile surfaces, through the real HTTP pipeline and SQL.
// The gallery read model (TripPopularity) is normally filled by the projector, which needs the Service
// Bus broker the test factory doesn't run, so the feed/profile tests seed read-model rows directly and
// assert the query + mapping. The publish→followers notification is asserted on the outbox row it writes.
public sealed class FollowTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static Guid DevUser => ExplivioApiFactory.DevUserId;

    [Fact]
    public async Task Follow_is_idempotent_and_unfollow_removes_it()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        await SeedUserAsync(target, "Ana", ct);

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsAsync(me, HttpMethod.Post, $"/v1/users/{target}/follow", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsAsync(me, HttpMethod.Post, $"/v1/users/{target}/follow", ct)).StatusCode);
        Assert.Equal(1, await CountFollowsAsync(me, target, ct)); // second follow is a no-op

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsAsync(me, HttpMethod.Delete, $"/v1/users/{target}/follow", ct)).StatusCode);
        Assert.Equal(0, await CountFollowsAsync(me, target, ct));
    }

    [Fact]
    public async Task Cannot_follow_yourself()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();
        await SeedUserAsync(me, "Me", ct);

        var res = await SendAsAsync(me, HttpMethod.Post, $"/v1/users/{me}/follow", ct);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Following_an_unknown_user_is_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();

        var res = await SendAsAsync(me, HttpMethod.Post, $"/v1/users/{Guid.NewGuid()}/follow", ct);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Following_feed_returns_only_followed_owners_public_trips()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();
        var followed = Guid.NewGuid();
        var other = Guid.NewGuid();
        await SeedUserAsync(followed, "Ana", ct);
        await SeedUserAsync(other, "Ivan", ct);

        var followedTrip = Guid.NewGuid();
        var otherTrip = Guid.NewGuid();
        await SeedPopularityAsync(ct,
            Popularity(followedTrip, followed, "Ana's Lisbon"),
            Popularity(otherTrip, other, "Ivan's Rome"));

        await SendAsAsync(me, HttpMethod.Post, $"/v1/users/{followed}/follow", ct);

        var feed = await GetItemsAsync(me, "/v1/gallery/following", ct);

        Assert.Single(feed);
        Assert.Equal(followedTrip, feed[0].TripId);
        Assert.Equal(followed, feed[0].OwnerUserId);
        Assert.Equal("Ana", feed[0].OwnerDisplayName);
        Assert.True(feed[0].FollowedByMe);
    }

    [Fact]
    public async Task Profile_reports_counts_and_followed_flag()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        await SeedUserAsync(target, "Ana", ct);

        await SendAsAsync(me, HttpMethod.Post, $"/v1/users/{target}/follow", ct);

        // As the follower: sees the target, follows them, one follower, not me.
        var asMe = await GetProfileAsync(me, target, ct);
        Assert.Equal("Ana", asMe.DisplayName);
        Assert.Equal(1, asMe.FollowerCount);
        Assert.True(asMe.FollowedByMe);
        Assert.False(asMe.IsMe);

        // As the target viewing their own profile: isMe true, not following themselves.
        var asSelf = await GetProfileAsync(target, target, ct);
        Assert.True(asSelf.IsMe);
        Assert.False(asSelf.FollowedByMe);
    }

    [Fact]
    public async Task Publishing_a_trip_notifies_the_owners_followers()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);   // owner = DevUser
        var follower = Guid.NewGuid();
        await SeedFollowAsync(follower, DevUser, ct);

        var publish = await _client.PatchAsJsonAsync($"/v1/trips/{tripId}/visibility", new { isPublic = true }, ct);
        Assert.Equal(HttpStatusCode.NoContent, publish.StatusCode);

        var evt = await LatestPublishedOutboxAsync(tripId, ct);
        Assert.NotNull(evt);
        Assert.Equal("TripPublished", evt!.Kind);
        Assert.Contains(follower, evt.RecipientUserIds);
    }

    [Fact]
    public async Task Publishing_a_trip_with_no_followers_writes_no_notification()
    {
        var ct = TestContext.Current.CancellationToken;
        // A distinct owner with no followers, so other tests' DevUser followers don't interfere.
        var owner = Guid.NewGuid();
        var soloTrip = await CreateTripAsAsync(owner, ct);

        await _client.SendAsync(Publish(owner, soloTrip), ct);

        Assert.Null(await LatestPublishedOutboxAsync(soloTrip, ct));
    }

    // --- helpers ---------------------------------------------------------------------------------

    private Task<HttpResponseMessage> SendAsAsync(Guid user, HttpMethod method, string path, CancellationToken ct)
    {
        var req = new HttpRequestMessage(method, path);
        req.Headers.Add("X-Dev-User", user.ToString());
        return _client.SendAsync(req, ct);
    }

    private static HttpRequestMessage Publish(Guid user, Guid tripId)
    {
        var req = new HttpRequestMessage(HttpMethod.Patch, $"/v1/trips/{tripId}/visibility")
        {
            Content = JsonContent.Create(new { isPublic = true }),
        };
        req.Headers.Add("X-Dev-User", user.ToString());
        return req;
    }

    private async Task<List<GalleryItemDto>> GetItemsAsync(Guid user, string path, CancellationToken ct)
    {
        var res = await SendAsAsync(user, HttpMethod.Get, path, ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<List<GalleryItemDto>>(ct))!;
    }

    private async Task<UserProfileDto> GetProfileAsync(Guid asUser, Guid target, CancellationToken ct)
    {
        var res = await SendAsAsync(asUser, HttpMethod.Get, $"/v1/users/{target}/profile", ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<UserProfileDto>(ct))!;
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Follow Trip", startDate = "2026-11-01", endDate = "2026-11-03",
            travelerCount = 2, stops = new[] { new { place = "Lisbon" } }, userId = DevUser,
        }, ct);
        return (await create.Content.ReadFromJsonAsync<CreatedDto>(ct))!.Id;
    }

    private async Task<Guid> CreateTripAsAsync(Guid owner, CancellationToken ct)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/trips")
        {
            Content = JsonContent.Create(new
            {
                name = "Solo Trip", startDate = "2026-11-01", endDate = "2026-11-03",
                travelerCount = 1, stops = new[] { new { place = "Porto" } }, userId = owner,
            }),
        };
        req.Headers.Add("X-Dev-User", owner.ToString());
        var create = await _client.SendAsync(req, ct);
        return (await create.Content.ReadFromJsonAsync<CreatedDto>(ct))!.Id;
    }

    private async Task SeedUserAsync(Guid id, string displayName, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (!await db.Users.AnyAsync(u => u.Id == id, ct))
        {
            db.Users.Add(new User { Id = id, Email = $"{id:N}@example.com", DisplayName = displayName, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
        }
    }

    private async Task SeedFollowAsync(Guid follower, Guid followed, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.UserFollows.Add(new UserFollow
        {
            Id = Guid.NewGuid(), FollowerUserId = follower, FollowedUserId = followed, CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedPopularityAsync(CancellationToken ct, params TripPopularity[] rows)
    {
        using var scope = _factory.Services.CreateScope();
        var read = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
        read.TripPopularity.AddRange(rows);
        await read.SaveChangesAsync(ct);
    }

    private static TripPopularity Popularity(Guid tripId, Guid ownerId, string name) => new()
    {
        TripId = tripId,
        OwnerUserId = ownerId,
        Name = name,
        Destination = "Somewhere",
        StartDate = new DateOnly(2026, 11, 1),
        EndDate = new DateOnly(2026, 11, 3),
        TravelerCount = 2,
        HasCoverPhoto = false,
        IsPublic = true,
        LikeCount = 0,
        UpdatedAt = DateTime.UtcNow,
    };

    private async Task<int> CountFollowsAsync(Guid follower, Guid followed, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.UserFollows.CountAsync(f => f.FollowerUserId == follower && f.FollowedUserId == followed, ct);
    }

    private async Task<PublishedDto?> LatestPublishedOutboxAsync(Guid tripId, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var contents = await db.OutboxMessages
            .Where(m => m.Type == "TripNotificationRaised")
            .OrderByDescending(m => m.OccurredOnUtc)
            .Select(m => m.Content)
            .ToListAsync(ct);
        return contents
            .Select(c => JsonSerializer.Deserialize<PublishedDto>(c, Web))
            .FirstOrDefault(e => e!.TripId == tripId && e.Kind == "TripPublished");
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record GalleryItemDto(Guid TripId, Guid OwnerUserId, string OwnerDisplayName, bool FollowedByMe);
    private sealed record UserProfileDto(Guid UserId, string DisplayName, int FollowerCount, int FollowingCount, bool FollowedByMe, bool IsMe);
    private sealed record PublishedDto(Guid TripId, string Kind, Guid[] RecipientUserIds);
}
