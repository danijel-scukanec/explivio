using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;

namespace Explivio.API.Infrastructure.Weather;

// F28: per-day weather + time zone from Open-Meteo (open-meteo.com; keyless, free for non-commercial
// use). Two endpoints are used: the forecast API for dates within its ~16-day window, and the
// historical archive API for dates beyond it — a trip planned months ahead still gets a sensible
// "typical conditions" estimate from last year's weather on the same calendar dates. Both are called
// with timezone=auto, so each response also carries the location's IANA time zone + current UTC
// offset. The HttpClient gets retries, a timeout and a circuit breaker for free from ServiceDefaults'
// standard resilience handler; a location's snapshot is cached so the typical conditions view makes
// at most two outbound calls and then reads cache.
public sealed class OpenMeteoWeatherProvider(
    HttpClient httpClient,
    IMemoryCache cache,
    IConfiguration configuration,
    ILogger<OpenMeteoWeatherProvider> logger) : IWeatherProvider
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(3);

    // How many days ahead the forecast API reliably covers. Dates past this fall back to seasonal.
    private const int ForecastHorizonDays = 15;

    private readonly string _forecastBaseUrl =
        configuration["Weather:ForecastBaseUrl"] ?? "https://api.open-meteo.com/";
    private readonly string _archiveBaseUrl =
        configuration["Weather:ArchiveBaseUrl"] ?? "https://archive-api.open-meteo.com/";

    public async Task<LocationWeather?> GetWeatherAsync(
        double latitude, double longitude, DateOnly startDate, DateOnly endDate,
        CancellationToken cancellationToken)
    {
        if (endDate < startDate)
            (startDate, endDate) = (endDate, startDate);

        // Coordinates are rounded for the cache key so two nearby activities at the same resort share
        // a snapshot — weather doesn't vary at 4-decimal precision.
        var cacheKey = $"weather:{latitude:F2}:{longitude:F2}:{startDate:O}:{endDate:O}";
        if (cache.TryGetValue<LocationWeather>(cacheKey, out var cached) && cached is not null)
            return cached;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var forecastHorizon = today.AddDays(ForecastHorizonDays);

        // Split the requested range into the part the live forecast covers and the part that doesn't.
        var forecastStart = startDate < today ? today : startDate;
        var forecastEnd = endDate < forecastHorizon ? endDate : forecastHorizon;
        var hasForecastPart = forecastStart <= forecastEnd && forecastEnd >= today && forecastStart <= forecastHorizon;

        try
        {
            var days = new List<DailyWeather>();
            LocationWeather? resolved = null;

            if (hasForecastPart)
            {
                var forecast = await FetchAsync(
                    _forecastBaseUrl, "v1/forecast", latitude, longitude, forecastStart, forecastEnd,
                    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
                    WeatherSource.Forecast, cancellationToken);
                if (forecast is not null)
                {
                    resolved = forecast;
                    days.AddRange(forecast.Days);
                }
            }

            // Everything the forecast didn't cover (further out, or in the past) → seasonal estimate
            // from the same calendar dates a year back, which the archive always has (it trails real
            // time by a few days, so last year is complete). Map each seasonal day back to its real date.
            var seasonalDates = EnumerateDates(startDate, endDate)
                .Where(d => !hasForecastPart || d < forecastStart || d > forecastEnd)
                .ToList();

            if (seasonalDates.Count > 0)
            {
                var refYear = today.Year - 1;
                DateOnly ToSeasonal(DateOnly d) => SafeDate(refYear, d.Month, d.Day);
                var seasonalStart = ToSeasonal(seasonalDates.Min());
                var seasonalEnd = ToSeasonal(seasonalDates.Max());

                var archive = await FetchAsync(
                    _archiveBaseUrl, "v1/archive", latitude, longitude, seasonalStart, seasonalEnd,
                    "temperature_2m_max,temperature_2m_min,weather_code",
                    WeatherSource.Seasonal, cancellationToken);
                if (archive is not null)
                {
                    resolved ??= archive;
                    var byMonthDay = archive.Days.ToDictionary(d => (d.Date.Month, d.Date.Day));
                    foreach (var realDate in seasonalDates)
                    {
                        if (byMonthDay.TryGetValue((realDate.Month, realDate.Day), out var estimate))
                            days.Add(estimate with { Date = realDate });
                    }
                }
            }

            if (resolved is null)
                return null;

            var result = resolved with { Days = days.OrderBy(d => d.Date).ToList() };
            cache.Set(cacheKey, result, CacheTtl);
            return result;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            // Degrade: the conditions view still shows the stop (time zone/currency come from the first
            // call that did succeed, or are simply omitted). Not an application error — log and move on.
            logger.LogWarning(ex, "Could not fetch weather for ({Lat},{Lon}); weather unavailable.", latitude, longitude);
            return null;
        }
    }

    private async Task<LocationWeather?> FetchAsync(
        string baseUrl, string path, double latitude, double longitude,
        DateOnly start, DateOnly end, string daily, WeatherSource source,
        CancellationToken cancellationToken)
    {
        var inv = CultureInfo.InvariantCulture;
        var url = $"{baseUrl.TrimEnd('/')}/{path}?latitude={latitude.ToString(inv)}" +
                  $"&longitude={longitude.ToString(inv)}&daily={daily}&timezone=auto" +
                  $"&start_date={start:yyyy-MM-dd}&end_date={end:yyyy-MM-dd}";

        var dto = await httpClient.GetFromJsonAsync<OpenMeteoResponse>(url, cancellationToken);
        if (dto?.Daily?.Time is not { Count: > 0 })
            return null;

        var days = new List<DailyWeather>(dto.Daily.Time.Count);
        for (var i = 0; i < dto.Daily.Time.Count; i++)
        {
            var max = dto.Daily.TemperatureMax?.ElementAtOrDefault(i);
            var min = dto.Daily.TemperatureMin?.ElementAtOrDefault(i);
            var code = dto.Daily.WeatherCode?.ElementAtOrDefault(i);
            if (max is null || min is null || code is null)
                continue;  // a missing day (provider gap) is skipped rather than shown as 0°C

            days.Add(new DailyWeather(
                dto.Daily.Time[i],
                max.Value,
                min.Value,
                source == WeatherSource.Forecast ? dto.Daily.PrecipitationProbability?.ElementAtOrDefault(i) : null,
                code.Value,
                source));
        }

        return new LocationWeather(
            dto.Timezone ?? "UTC",
            dto.TimezoneAbbreviation ?? string.Empty,
            dto.UtcOffsetSeconds ?? 0,
            days);
    }

    private static IEnumerable<DateOnly> EnumerateDates(DateOnly start, DateOnly end)
    {
        for (var d = start; d <= end; d = d.AddDays(1))
            yield return d;
    }

    // Maps a calendar day into a reference year, folding Feb 29 to Feb 28 in a non-leap year.
    private static DateOnly SafeDate(int year, int month, int day)
    {
        var maxDay = DateTime.DaysInMonth(year, month);
        return new DateOnly(year, month, Math.Min(day, maxDay));
    }

    // Shape of the Open-Meteo forecast/archive responses (the daily arrays run in parallel by index).
    private sealed record OpenMeteoResponse(
        [property: JsonPropertyName("timezone")] string? Timezone,
        [property: JsonPropertyName("timezone_abbreviation")] string? TimezoneAbbreviation,
        [property: JsonPropertyName("utc_offset_seconds")] int? UtcOffsetSeconds,
        [property: JsonPropertyName("daily")] OpenMeteoDaily? Daily);

    private sealed record OpenMeteoDaily(
        [property: JsonPropertyName("time")] IReadOnlyList<DateOnly>? Time,
        [property: JsonPropertyName("temperature_2m_max")] IReadOnlyList<double?>? TemperatureMax,
        [property: JsonPropertyName("temperature_2m_min")] IReadOnlyList<double?>? TemperatureMin,
        [property: JsonPropertyName("precipitation_probability_max")] IReadOnlyList<int?>? PrecipitationProbability,
        [property: JsonPropertyName("weather_code")] IReadOnlyList<int?>? WeatherCode);
}
