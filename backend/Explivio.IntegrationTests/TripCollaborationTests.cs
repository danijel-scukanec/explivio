using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F15: end-to-end coverage of trip sharing + membership authorization through the real pipeline.
// Different users are simulated with the X-Dev-User header (the dev-only identity switch).
public sealed class TripCollaborationTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private static readonly Guid UserA = ExplivioApiFactory.DevUserId;
    private static readonly Guid UserB = Guid.Parse("00000000-0000-0000-0000-0000000000b0");

    private readonly HttpClient _client = factory.CreateClient();

    private async Task<HttpResponseMessage> Send(
        HttpMethod method, string url, Guid user, object? body, CancellationToken ct)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Dev-User", user.ToString());
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await _client.SendAsync(request, ct);
    }

    private async Task<Guid> CreateTripAsync(Guid user, CancellationToken ct)
    {
        var response = await Send(HttpMethod.Post, "/v1/trips", user, new
        {
            name = "Shared Trip",
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 2,
            stops = new[] { new { place = "Lisbon" } },
            userId = user,
        }, ct);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private Task<HttpResponseMessage> AddMemberAsync(Guid tripId, Guid owner, Guid member, string role, CancellationToken ct) =>
        Send(HttpMethod.Post, $"/v1/trips/{tripId}/members", owner, new { userId = member, role }, ct);

    [Fact]
    public async Task Non_member_cannot_access_a_trip()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(UserA, ct);

        var response = await Send(HttpMethod.Get, $"/v1/trips/{tripId}", UserB, null, ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Shared_editor_can_read_write_and_see_the_trip_in_their_list()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(UserA, ct);

        var share = await AddMemberAsync(tripId, UserA, UserB, "Editor", ct);
        Assert.Equal(HttpStatusCode.OK, share.StatusCode);

        // B can read the trip.
        var get = await Send(HttpMethod.Get, $"/v1/trips/{tripId}", UserB, null, ct);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);

        // B (Editor) can add an activity.
        var addActivity = await Send(HttpMethod.Post, $"/v1/trips/{tripId}/activities", UserB, new
        {
            name = "Belém Tower",
            date = "2026-09-02",
            category = "Sightseeing",
        }, ct);
        Assert.Equal(HttpStatusCode.Created, addActivity.StatusCode);

        // The shared trip shows up in B's trip list.
        var list = await Send(HttpMethod.Get, "/v1/trips", UserB, null, ct);
        var trips = await list.Content.ReadFromJsonAsync<List<TripListItem>>(ct);
        Assert.Contains(trips!, t => t.Id == tripId);
    }

    [Fact]
    public async Task Viewer_cannot_write()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(UserA, ct);
        await AddMemberAsync(tripId, UserA, UserB, "Viewer", ct);

        // A Viewer can read activities...
        var read = await Send(HttpMethod.Get, $"/v1/trips/{tripId}/activities", UserB, null, ct);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        // ...but not add one.
        var write = await Send(HttpMethod.Post, $"/v1/trips/{tripId}/activities", UserB, new
        {
            name = "Nope",
            date = "2026-09-02",
            category = "Sightseeing",
        }, ct);
        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
    }

    [Fact]
    public async Task The_last_owner_cannot_be_removed()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(UserA, ct);

        var response = await Send(HttpMethod.Delete, $"/v1/trips/{tripId}/members/{UserA}", UserA, null, ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed record CreatedResponse(Guid Id);

    private sealed record TripListItem(Guid Id, string Name, string Destination);
}
