using System.Net;
using System.Net.Http.Json;
using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F26: end-to-end coverage of the write side of the gallery feature — publish/visibility, share
// links, likes, and clone — through the real HTTP pipeline and SQL. The gallery LIST and like counts
// are served from the projected read model, which needs the Service Bus broker (not configured in the
// broker-free test factory), so those are verified live via the AppHost; here we assert the write
// model and the endpoints that read it directly.
public sealed class GallerySharingTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    [Fact]
    public async Task Publish_lists_trip_in_gallery_detail_unpublish_hides_it()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        // Not public yet → gallery detail 404.
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/v1/gallery/{tripId}", ct)).StatusCode);

        var publish = await _client.PatchAsJsonAsync($"/v1/trips/{tripId}/visibility", new { isPublic = true }, ct);
        Assert.Equal(HttpStatusCode.NoContent, publish.StatusCode);

        // Trip detail reports it public; gallery detail now serves it.
        var trip = await _client.GetFromJsonAsync<TripDto>($"/v1/trips/{tripId}", ct);
        Assert.True(trip!.IsPublic);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"/v1/gallery/{tripId}", ct)).StatusCode);

        // Unpublish → gallery detail 404 again.
        await _client.PatchAsJsonAsync($"/v1/trips/{tripId}/visibility", new { isPublic = false }, ct);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/v1/gallery/{tripId}", ct)).StatusCode);
    }

    [Fact]
    public async Task Share_link_grants_read_access_then_revoke_removes_it()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var share = await _client.PostAsync($"/v1/trips/{tripId}/share", null, ct);
        Assert.Equal(HttpStatusCode.OK, share.StatusCode);
        var link = await share.Content.ReadFromJsonAsync<ShareDto>(ct);
        Assert.False(string.IsNullOrWhiteSpace(link!.ShareToken));

        // The token resolves the trip (a private trip, viewed without membership).
        var viewed = await _client.GetAsync($"/v1/trips/shared/{link.ShareToken}", ct);
        Assert.Equal(HttpStatusCode.OK, viewed.StatusCode);
        var trip = await viewed.Content.ReadFromJsonAsync<TripDto>(ct);
        Assert.Equal(tripId, trip!.Id);

        // Revoke → the token no longer resolves.
        await _client.DeleteAsync($"/v1/trips/{tripId}/share", ct);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/v1/trips/shared/{link.ShareToken}", ct)).StatusCode);
    }

    [Fact]
    public async Task Liking_a_public_trip_is_idempotent_and_unlike_removes_it()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        await _client.PatchAsJsonAsync($"/v1/trips/{tripId}/visibility", new { isPublic = true }, ct);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync($"/v1/trips/{tripId}/like", null, ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync($"/v1/trips/{tripId}/like", null, ct)).StatusCode);
        Assert.Equal(1, await CountLikesAsync(tripId, ct)); // second like is a no-op

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/v1/trips/{tripId}/like", ct)).StatusCode);
        Assert.Equal(0, await CountLikesAsync(tripId, ct));
    }

    [Fact]
    public async Task Cannot_like_a_private_trip_you_are_not_a_member_of()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct); // private, owned by the default dev user

        var otherUser = Guid.NewGuid();
        var req = new HttpRequestMessage(HttpMethod.Post, $"/v1/trips/{tripId}/like");
        req.Headers.Add("X-Dev-User", otherUser.ToString());
        var res = await _client.SendAsync(req, ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal(0, await CountLikesAsync(tripId, ct));
    }

    [Fact]
    public async Task Clone_of_a_public_trip_copies_route_into_a_new_owned_trip()
    {
        var ct = TestContext.Current.CancellationToken;
        var sourceId = await CreateTripAsync(ct);
        await _client.PatchAsJsonAsync($"/v1/trips/{sourceId}/visibility", new { isPublic = true }, ct);

        // A different user clones it.
        var cloner = Guid.NewGuid();
        var cloneReq = new HttpRequestMessage(HttpMethod.Post, $"/v1/trips/{sourceId}/clone");
        cloneReq.Headers.Add("X-Dev-User", cloner.ToString());
        var cloneRes = await _client.SendAsync(cloneReq, ct);
        Assert.Equal(HttpStatusCode.Created, cloneRes.StatusCode);
        var created = await cloneRes.Content.ReadFromJsonAsync<CreatedDto>(ct);

        // The cloner owns the new trip and sees the copied route (name marked a copy).
        var getReq = new HttpRequestMessage(HttpMethod.Get, $"/v1/trips/{created!.Id}");
        getReq.Headers.Add("X-Dev-User", cloner.ToString());
        var clone = await (await _client.SendAsync(getReq, ct)).Content.ReadFromJsonAsync<TripDto>(ct);
        Assert.Equal("Gallery Trip (copy)", clone!.Name);
        Assert.False(clone.IsPublic); // a clone starts private
        Assert.Single(clone.Stops);
        Assert.Equal("Porto", clone.Stops[0].Place);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Gallery Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 2,
            stops = new[] { new { place = "Porto" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedDto>(ct);
        return created!.Id;
    }

    private async Task<int> CountLikesAsync(Guid tripId, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.TripLikes.CountAsync(l => l.TripId == tripId, ct);
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record ShareDto(string ShareToken);
    private sealed record StopDto(string Place);
    private sealed record TripDto(Guid Id, string Name, bool IsPublic, List<StopDto> Stops);
}
