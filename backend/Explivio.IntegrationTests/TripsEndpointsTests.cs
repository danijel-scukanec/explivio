using System.Net;
using System.Net.Http.Json;
using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F10: end-to-end coverage of the Trips slice through the real HTTP pipeline and SQL.
// Also closes the previously-unverified DB-backed 404 path (Result.NotFound -> ProblemDetails).
public sealed class TripsEndpointsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    [Fact]
    public async Task Create_then_get_trip_round_trips_through_the_database()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Summer in Portugal",
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 2,
            stops = new[] { new { place = "Lisbon" } },
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
        Assert.Single(trip.Stops);
        Assert.Equal("Lisbon", trip.Stops[0].Place);
    }

    [Fact]
    public async Task Create_multi_stop_trip_returns_ordered_stops_and_derived_destination()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Iberian Tour",
            startDate = "2026-09-01",
            endDate = "2026-09-14",
            travelerCount = 2,
            stops = new[]
            {
                new { place = "Lisbon", arriveDate = "2026-09-01", departDate = "2026-09-05" },
                new { place = "Porto", arriveDate = "2026-09-05", departDate = "2026-09-09" },
                new { place = "Madrid", arriveDate = "2026-09-09", departDate = "2026-09-14" },
            },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var trip = await _client.GetFromJsonAsync<TripResponse>($"/v1/trips/{created!.Id}", ct);
        Assert.NotNull(trip);
        Assert.Equal("Lisbon → Porto → Madrid", trip!.Destination);
        Assert.Equal(new[] { "Lisbon", "Porto", "Madrid" }, trip.Stops.Select(s => s.Place));
        Assert.Equal(new[] { 0, 1, 2 }, trip.Stops.Select(s => s.Order));
    }

    [Fact]
    public async Task Replace_stops_updates_the_route_and_derived_destination()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Reroute",
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 1,
            stops = new[] { new { place = "Lisbon" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var put = await _client.PutAsJsonAsync($"/v1/trips/{created!.Id}/stops", new
        {
            stops = new[]
            {
                new { place = "Barcelona" },
                new { place = "Rome" },
            },
        }, ct);
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        var trip = await _client.GetFromJsonAsync<TripResponse>($"/v1/trips/{created.Id}", ct);
        Assert.Equal("Barcelona → Rome", trip!.Destination);
        Assert.Equal(new[] { "Barcelona", "Rome" }, trip.Stops.Select(s => s.Place));
    }

    [Fact]
    public async Task Replace_stops_with_empty_list_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "No Stops",
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 1,
            stops = new[] { new { place = "Lisbon" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var put = await _client.PutAsJsonAsync($"/v1/trips/{created!.Id}/stops",
            new { stops = Array.Empty<object>() }, ct);

        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
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
            startDate = "2026-09-07",
            endDate = "2026-09-01", // end before start
            travelerCount = 0,
            stops = Array.Empty<object>(), // a trip needs at least one stop
            userId = ExplivioApiFactory.DevUserId,
        }, ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Creating_a_trip_writes_a_transactional_outbox_message()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Outbox Trip",
            startDate = "2026-10-01",
            endDate = "2026-10-05",
            travelerCount = 1,
            stops = new[] { new { place = "Porto" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);

        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        Assert.NotNull(created);

        // The interceptor should have written the domain event into the outbox in the same
        // transaction as the trip. No broker is configured in tests, so it stays unprocessed.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var outboxMessage = await db.OutboxMessages
            .SingleOrDefaultAsync(m => m.Content.Contains(created!.Id.ToString()), ct);

        Assert.NotNull(outboxMessage);
        Assert.Equal("TripCreatedDomainEvent", outboxMessage!.Type);
        Assert.Null(outboxMessage.ProcessedOnUtc);
    }

    [Fact]
    public async Task Set_status_defaults_to_planned_then_updates()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Status Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            stops = new[] { new { place = "Rome" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var initial = await _client.GetFromJsonAsync<TripResponse>($"/v1/trips/{created!.Id}", ct);
        Assert.Equal("Planned", initial!.Status);

        var patch = await _client.PatchAsJsonAsync($"/v1/trips/{created.Id}/status", new { status = "Active" }, ct);
        Assert.Equal(HttpStatusCode.NoContent, patch.StatusCode);

        var updated = await _client.GetFromJsonAsync<TripResponse>($"/v1/trips/{created.Id}", ct);
        Assert.Equal("Active", updated!.Status);
    }

    [Fact]
    public async Task Set_status_with_invalid_value_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;

        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Bad Status Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            stops = new[] { new { place = "Rome" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var patch = await _client.PatchAsJsonAsync($"/v1/trips/{created!.Id}/status", new { status = "Nope" }, ct);
        Assert.Equal(HttpStatusCode.BadRequest, patch.StatusCode);
    }

    private sealed record CreatedResponse(Guid Id);

    private sealed record TripResponse(
        Guid Id, string Name, string Destination, int TravelerCount, string Status,
        IReadOnlyList<TripStopDto> Stops);

    private sealed record TripStopDto(Guid Id, int Order, string Place);
}
