using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Explivio.IntegrationTests;

// F18: the booking-parse endpoint's deterministic guards. The extraction itself runs against a real
// model (verified live), so here we cover the no-model gate (503) and file-type validation (400).
public sealed class ParseBookingTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly ExplivioApiFactory _factory = factory;

    [Fact]
    public async Task Parse_without_a_configured_model_returns_503()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = _factory.WithWebHostBuilder(b =>
            b.ConfigureAppConfiguration((_, c) =>
                c.AddInMemoryCollection(new Dictionary<string, string?> { ["AI:Endpoint"] = "" })))
            .CreateClient();

        var tripId = await CreateTripAsync(client, ct);
        var res = await client.PostAsync(
            $"/v1/trips/{tripId}/parse-booking", FileContent("From: airline\nFlight AB123", "text/plain"), ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
    }

    [Fact]
    public async Task Parse_with_an_unsupported_file_type_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;
        // A configured endpoint passes the 503 gate; no API key means the deterministic stub backs
        // IChatClient, but file-type validation rejects the upload before any model is called.
        var client = _factory.WithWebHostBuilder(b =>
            b.ConfigureAppConfiguration((_, c) =>
                c.AddInMemoryCollection(new Dictionary<string, string?> { ["AI:Endpoint"] = "https://dummy.test" })))
            .CreateClient();

        var tripId = await CreateTripAsync(client, ct);
        var res = await client.PostAsync(
            $"/v1/trips/{tripId}/parse-booking", FileContent("%PDF-1.4 fake", "application/pdf"), ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    private static async Task<Guid> CreateTripAsync(HttpClient client, CancellationToken ct)
    {
        var create = await client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Booking Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            stops = new[] { new { place = "Lisbon" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private static MultipartFormDataContent FileContent(string body, string contentType)
    {
        var file = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(body));
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", "booking" } };
    }

    private sealed record CreatedResponse(Guid Id);
}
