using System.Net;
using System.Net.Http.Json;
using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F04 (boundary idempotency): a mutating request carrying an Idempotency-Key can be retried safely —
// the retry replays the original response and does not create a second resource. Verified end-to-end
// through the middleware + real SQL.
public sealed class IdempotencyTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    [Fact]
    public async Task Same_key_replays_the_response_and_creates_one_trip()
    {
        var ct = TestContext.Current.CancellationToken;
        var key = Guid.NewGuid().ToString();
        var name = $"Idem {key}";

        var first = await _client.SendAsync(CreateTripRequest(key, name), ct);
        var firstBody = await first.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.False(first.Headers.Contains("Idempotency-Replayed"));
        Assert.NotNull(firstBody);

        // Retry with the same key — must replay, not re-create.
        var second = await _client.SendAsync(CreateTripRequest(key, name), ct);
        var secondBody = await second.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.True(second.Headers.Contains("Idempotency-Replayed"));
        Assert.Equal(firstBody!.Id, secondBody!.Id);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Trips.CountAsync(t => t.Name == name, ct);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Different_keys_create_separate_trips()
    {
        var ct = TestContext.Current.CancellationToken;
        var name = $"Distinct {Guid.NewGuid()}";

        await _client.SendAsync(CreateTripRequest(Guid.NewGuid().ToString(), name), ct);
        await _client.SendAsync(CreateTripRequest(Guid.NewGuid().ToString(), name), ct);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Trips.CountAsync(t => t.Name == name, ct);
        Assert.Equal(2, count);
    }

    private static HttpRequestMessage CreateTripRequest(string idempotencyKey, string name)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/v1/trips")
        {
            Content = JsonContent.Create(new
            {
                name,
                destination = "Lisbon",
                startDate = "2026-09-01",
                endDate = "2026-09-07",
                travelerCount = 2,
                userId = ExplivioApiFactory.DevUserId,
            }),
        };
        request.Headers.Add("Idempotency-Key", idempotencyKey);
        return request;
    }

    private sealed record CreatedResponse(Guid Id);
}
