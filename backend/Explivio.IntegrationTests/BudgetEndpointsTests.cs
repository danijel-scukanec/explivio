using System.Net;
using System.Net.Http.Json;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Users;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F25: budget deepening — multi-currency conversion (fake FX), expense splitting + settle-up, and
// CSV/PDF export, through the real HTTP pipeline and SQL. FX is the deterministic FakeFxRateProvider
// (1 EUR = 1.10 USD = 0.85 GBP), so the converted figures below are exact.
public sealed class BudgetEndpointsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    private static readonly Guid SecondUserId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    [Fact]
    public async Task Summary_converts_mixed_currencies_into_the_trip_base_currency()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync("Mixed Currency", baseCurrency: "EUR", ct);

        await AddExpenseAsync(tripId, "Hotel", 110m, "USD", "Accommodation", ct);
        await AddExpenseAsync(tripId, "Tour", 85m, "GBP", "Activities", ct);

        var summary = await _client.GetFromJsonAsync<BudgetSummaryDto>($"/v1/trips/{tripId}/expenses", ct);

        Assert.NotNull(summary);
        Assert.Equal("EUR", summary!.BaseCurrency);
        Assert.True(summary.ConversionAvailable);
        // 110 USD / 1.10 = 100 EUR; 85 GBP / 0.85 = 100 EUR.
        Assert.Equal(200m, summary.Total);
        Assert.Contains(summary.ByCurrency, c => c.Currency == "USD" && c.Total == 110m);
        Assert.Contains(summary.ByCurrency, c => c.Currency == "GBP" && c.Total == 85m);
    }

    [Fact]
    public async Task Split_expense_produces_balances_and_a_settle_up()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync("Split Trip", baseCurrency: "EUR", ct);
        await AddTripMemberAsync(tripId, SecondUserId, "Alex", ct);

        // Dev user pays 100 EUR, split evenly with the second member.
        var body = new
        {
            description = "Dinner",
            amount = 100m,
            currency = "EUR",
            category = "Food",
            date = "2026-09-02",
            paidByUserId = ExplivioApiFactory.DevUserId,
            splits = new[]
            {
                new { userId = ExplivioApiFactory.DevUserId, amount = 50m },
                new { userId = SecondUserId, amount = 50m },
            },
        };
        var post = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/expenses", body, ct);
        Assert.Equal(HttpStatusCode.Created, post.StatusCode);

        var balances = await _client.GetFromJsonAsync<BudgetBalancesDto>($"/v1/trips/{tripId}/expenses/balances", ct);
        Assert.NotNull(balances);

        var payer = balances!.Balances.Single(b => b.UserId == ExplivioApiFactory.DevUserId);
        var other = balances.Balances.Single(b => b.UserId == SecondUserId);
        Assert.Equal(50m, payer.Net);   // paid 100, owes 50 → +50
        Assert.Equal(-50m, other.Net);  // owes 50 → -50

        var settlement = Assert.Single(balances.Settlements);
        Assert.Equal(SecondUserId, settlement.FromUserId);
        Assert.Equal(ExplivioApiFactory.DevUserId, settlement.ToUserId);
        Assert.Equal(50m, settlement.Amount);
    }

    [Fact]
    public async Task Split_whose_shares_do_not_sum_to_amount_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync("Bad Split", baseCurrency: "EUR", ct);

        var body = new
        {
            description = "Taxi",
            amount = 100m,
            currency = "EUR",
            category = "Transport",
            date = "2026-09-02",
            paidByUserId = ExplivioApiFactory.DevUserId,
            splits = new[] { new { userId = ExplivioApiFactory.DevUserId, amount = 40m } }, // 40 ≠ 100
        };
        var post = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/expenses", body, ct);

        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);
    }

    [Theory]
    [InlineData("csv", "text/csv")]
    [InlineData("pdf", "application/pdf")]
    public async Task Export_returns_a_file_of_the_requested_format(string format, string expectedContentType)
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync($"Export {format}", baseCurrency: "EUR", ct);
        await AddExpenseAsync(tripId, "Lunch", 20m, "EUR", "Food", ct);

        var response = await _client.GetAsync($"/v1/trips/{tripId}/expenses/export?format={format}", ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expectedContentType, response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        Assert.NotEmpty(bytes);
    }

    private async Task<Guid> CreateTripAsync(string name, string baseCurrency, CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name,
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 2,
            stops = new[] { new { place = "Lisbon" } },
            userId = ExplivioApiFactory.DevUserId,
            baseCurrency,
        }, ct);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreatedDto>(ct);
        return created!.Id;
    }

    private async Task AddExpenseAsync(
        Guid tripId, string description, decimal amount, string currency, string category, CancellationToken ct)
    {
        var post = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/expenses", new
        {
            description, amount, currency, category, date = "2026-09-02",
        }, ct);
        Assert.Equal(HttpStatusCode.Created, post.StatusCode);
    }

    // Seeds a second user and makes them an Editor member of the trip, directly through the DB —
    // there's no user-registration-plus-share flow needed for these budget tests.
    private async Task AddTripMemberAsync(Guid tripId, Guid userId, string displayName, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!db.Users.Any(u => u.Id == userId))
            db.Users.Add(new User { Id = userId, Email = $"{displayName}@example.com", DisplayName = displayName, CreatedAt = DateTime.UtcNow });
        if (!db.TripMembers.Any(m => m.TripId == tripId && m.UserId == userId))
            db.TripMembers.Add(TripMember.Create(tripId, userId, TripRole.Editor));

        // The dev user is created as the trip owner by CreateTrip, but has no Users row; add one so the
        // balances join can show a display name.
        if (!db.Users.Any(u => u.Id == ExplivioApiFactory.DevUserId))
            db.Users.Add(new User { Id = ExplivioApiFactory.DevUserId, Email = "dev@example.com", DisplayName = "You", CreatedAt = DateTime.UtcNow });

        await db.SaveChangesAsync(ct);
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record BudgetSummaryDto(
        string BaseCurrency, bool ConversionAvailable, decimal Total,
        IReadOnlyList<CurrencyTotalDto> ByCurrency);
    private sealed record CurrencyTotalDto(string Currency, decimal Total);
    private sealed record BudgetBalancesDto(
        string BaseCurrency, bool ConversionAvailable,
        IReadOnlyList<MemberBalanceDto> Balances, IReadOnlyList<SettlementDto> Settlements);
    private sealed record MemberBalanceDto(Guid UserId, string DisplayName, decimal Paid, decimal Owed, decimal Net);
    private sealed record SettlementDto(Guid FromUserId, string FromName, Guid ToUserId, string ToName, decimal Amount);
}
