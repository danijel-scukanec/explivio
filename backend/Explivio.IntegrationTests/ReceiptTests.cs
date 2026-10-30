using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Explivio.IntegrationTests;

// F17: receipt-image storage (via the Azurite emulator the factory starts) + the scan endpoint's
// no-model gate. The vision extraction itself runs against a real model (proven live), so here we
// cover the deterministic halves: the image round-trips and flags the expense, and scanning without a
// configured model returns 503.
public sealed class ReceiptTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly ExplivioApiFactory _factory = factory;
    private readonly HttpClient _client = factory.CreateClient();

    // A valid 1x1 PNG.
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    [Fact]
    public async Task Upload_receipt_then_get_streams_it_and_flags_the_expense()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(_client, ct);
        var expenseId = await CreateExpenseAsync(_client, tripId, ct);

        var upload = await _client.PostAsync(
            $"/v1/trips/{tripId}/expenses/{expenseId}/receipt", ImageContent(TinyPng, "image/png"), ct);
        Assert.Equal(HttpStatusCode.NoContent, upload.StatusCode);

        // The budget summary now reports the receipt on that expense.
        var summary = await _client.GetFromJsonAsync<BudgetSummary>($"/v1/trips/{tripId}/expenses", ct);
        Assert.True(summary!.Expenses.Single(e => e.Id == expenseId).HasReceipt);

        // And it streams back with the stored content type + exact bytes.
        var get = await _client.GetAsync($"/v1/trips/{tripId}/expenses/{expenseId}/receipt", ct);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("image/png", get.Content.Headers.ContentType?.MediaType);
        Assert.Equal(TinyPng, await get.Content.ReadAsByteArrayAsync(ct));
    }

    [Fact]
    public async Task Get_receipt_when_none_returns_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(_client, ct);
        var expenseId = await CreateExpenseAsync(_client, tripId, ct);

        var get = await _client.GetAsync($"/v1/trips/{tripId}/expenses/{expenseId}/receipt", ct);
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task Scan_without_a_configured_model_returns_503()
    {
        var ct = TestContext.Current.CancellationToken;
        // Force "no model configured" regardless of any local user-secrets AI:Endpoint.
        var client = _factory.WithWebHostBuilder(b =>
            b.ConfigureAppConfiguration((_, c) =>
                c.AddInMemoryCollection(new Dictionary<string, string?> { ["AI:Endpoint"] = "" })))
            .CreateClient();

        var tripId = await CreateTripAsync(client, ct);
        var scan = await client.PostAsync(
            $"/v1/trips/{tripId}/expenses/scan", ImageContent(TinyPng, "image/png"), ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, scan.StatusCode);
    }

    private static async Task<Guid> CreateTripAsync(HttpClient client, CancellationToken ct)
    {
        var create = await client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Receipt Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            stops = new[] { new { place = "Lisbon" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private static async Task<Guid> CreateExpenseAsync(HttpClient client, Guid tripId, CancellationToken ct)
    {
        var create = await client.PostAsJsonAsync($"/v1/trips/{tripId}/expenses", new
        {
            tripId,
            description = "Lunch",
            amount = 12.5m,
            currency = "EUR",
            category = "Food",
            date = "2026-11-01",
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private static MultipartFormDataContent ImageContent(byte[] bytes, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", "receipt" } };
    }

    private sealed record CreatedResponse(Guid Id);
    private sealed record BudgetSummary(IReadOnlyList<ExpenseRow> Expenses);
    private sealed record ExpenseRow(Guid Id, bool HasReceipt);
}
