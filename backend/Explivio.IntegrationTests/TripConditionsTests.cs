using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F28: destination conditions through the real HTTP pipeline + SQL, with the deterministic fake
// weather provider (time zone America/New_York → USD) and fake FX (1 EUR = 1.10 USD).
public sealed class TripConditionsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Conditions_resolves_timezone_local_currency_rate_and_weather_for_a_located_stop()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(new
        {
            name = "Conditions Trip",
            startDate = "2026-09-01",
            endDate = "2026-09-03",
            travelerCount = 1,
            stops = new[] { new { place = "New York", latitude = 40.71, longitude = -74.0 } },
            userId = ExplivioApiFactory.DevUserId,
            baseCurrency = "EUR",
        }, ct);

        var conditions = await _client.GetFromJsonAsync<ConditionsDto>($"/v1/trips/{tripId}/conditions", ct);

        Assert.NotNull(conditions);
        Assert.Equal("EUR", conditions!.BaseCurrency);

        var stop = Assert.Single(conditions.Stops);
        Assert.True(stop.HasLocation);
        Assert.Equal("America/New_York", stop.TimeZoneId);
        Assert.Equal("USD", stop.LocalCurrency);
        Assert.Equal(1.10m, stop.LocalPerBaseUnit); // base EUR → 1 EUR buys 1.10 USD
        Assert.True(stop.WeatherAvailable);
        Assert.Equal(3, stop.Days.Count);            // one day per date in [01, 03]
        Assert.All(stop.Days, d => Assert.Equal("Forecast", d.Source));
    }

    [Fact]
    public async Task Stop_without_coordinates_still_appears_without_resolved_extras()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(new
        {
            name = "No Coords",
            startDate = "2026-09-01",
            endDate = "2026-09-03",
            travelerCount = 1,
            stops = new[] { new { place = "Somewhere" } },
            userId = ExplivioApiFactory.DevUserId,
            baseCurrency = "EUR",
        }, ct);

        var conditions = await _client.GetFromJsonAsync<ConditionsDto>($"/v1/trips/{tripId}/conditions", ct);

        var stop = Assert.Single(conditions!.Stops);
        Assert.False(stop.HasLocation);
        Assert.Null(stop.TimeZoneId);
        Assert.Null(stop.LocalCurrency);
        Assert.Null(stop.LocalPerBaseUnit);
        Assert.False(stop.WeatherAvailable);
        Assert.Empty(stop.Days);
    }

    private async Task<Guid> CreateTripAsync(object body, CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", body, ct);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreatedDto>(ct);
        return created!.Id;
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record ConditionsDto(string BaseCurrency, IReadOnlyList<StopDto> Stops);
    private sealed record StopDto(
        Guid StopId, int Order, string Place, double? Latitude, double? Longitude,
        bool HasLocation, string? TimeZoneId, string? TimeZoneAbbreviation, int? UtcOffsetSeconds,
        string? LocalCurrency, decimal? LocalPerBaseUnit, bool WeatherAvailable, IReadOnlyList<DayDto> Days);
    private sealed record DayDto(
        DateOnly Date, double TemperatureMaxC, double TemperatureMinC,
        int? PrecipitationProbability, int WeatherCode, string Source);
}
