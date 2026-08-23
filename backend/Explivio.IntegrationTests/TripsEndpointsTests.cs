using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F10: end-to-end coverage of the Trips slice through the real HTTP pipeline and SQL.
// Also closes the previously-unverified DB-backed 404 path (Result.NotFound -> ProblemDetails).
public sealed class TripsEndpointsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Create_then_get_trip_round_trips_through_the_database()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Summer in Portugal",
            destination = "Lisbon",
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 2,
            userId = ExplivioApiFactory.DevUserId,
        }, ct);

        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.Id);

        var get = await _client.GetAsync($"/v1/trips/{created.Id}", ct);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);

        var trip = await get.Content.ReadFromJsonAsync<TripResponse>(ct);
        Assert.NotNull(trip);
        Assert.Equal("Lisbon", trip!.Destination);
        Assert.Equal("Summer in Portugal", trip.Name);
    }

    [Fact]
    public async Task Get_unknown_trip_returns_404_problem_details()
    {
        var ct = TestContext.Current.CancellationToken;

        var response = await _client.GetAsync($"/v1/trips/{Guid.NewGuid()}", ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Create_trip_with_invalid_body_returns_400_validation_problem()
    {
        var ct = TestContext.Current.CancellationToken;

        var response = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "",
            destination = "",
            startDate = "2026-09-07",
            endDate = "2026-09-01", // end before start
            travelerCount = 0,
            userId = ExplivioApiFactory.DevUserId,
        }, ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private sealed record CreatedResponse(Guid Id);

    private sealed record TripResponse(
        Guid Id, string Name, string Destination, int TravelerCount);
}
