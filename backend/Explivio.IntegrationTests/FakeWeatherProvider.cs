using Explivio.API.Infrastructure.Weather;

namespace Explivio.IntegrationTests;

// F28: a deterministic weather provider for integration tests — no network. Returns a fixed time
// zone (America/New_York, which the currency heuristic maps to USD) and a forecast day for each date
// in the requested range, so the conditions endpoint can be asserted exactly and CI stays offline.
public sealed class FakeWeatherProvider : IWeatherProvider
{
    public Task<LocationWeather?> GetWeatherAsync(
        double latitude, double longitude, DateOnly startDate, DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var days = new List<DailyWeather>();
        for (var d = startDate; d <= endDate; d = d.AddDays(1))
            days.Add(new DailyWeather(d, 24.0, 15.0, 10, WeatherCode: 1, WeatherSource.Forecast));

        return Task.FromResult<LocationWeather?>(
            new LocationWeather("America/New_York", "EDT", UtcOffsetSeconds: -14400, days));
    }
}
