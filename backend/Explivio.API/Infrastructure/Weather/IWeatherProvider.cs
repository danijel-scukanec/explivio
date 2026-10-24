namespace Explivio.API.Infrastructure.Weather;

// F28: supplies per-day weather for a geographic point over a date range, plus the point's time zone
// (Open-Meteo resolves it for free via timezone=auto, so the conditions query gets weather AND the
// destination's time zone from a single call). Abstracted behind an interface — same posture as the
// FX/AI/RAG integrations — so the conditions handler depends on a contract, not on the HTTP client,
// and tests inject a deterministic fake (no network in CI).
public interface IWeatherProvider
{
    // Weather + time zone for one location over [startDate, endDate]. Null when nothing could be
    // fetched and nothing is cached — the caller degrades (still shows the stop, flags weather as
    // unavailable) rather than failing the whole request.
    Task<LocationWeather?> GetWeatherAsync(
        double latitude, double longitude, DateOnly startDate, DateOnly endDate,
        CancellationToken cancellationToken);
}

// Weather for one location, with the IANA time zone and current UTC offset resolved for that point.
public sealed record LocationWeather(
    string TimeZoneId,            // IANA id, e.g. "Europe/Lisbon"
    string TimeZoneAbbreviation,  // e.g. "WEST"
    int UtcOffsetSeconds,         // current offset at the location
    IReadOnlyList<DailyWeather> Days);

// One day's weather. Source distinguishes a real forecast from a seasonal estimate (last year's
// archive for the same calendar dates), so the UI can label far-future days honestly.
public sealed record DailyWeather(
    DateOnly Date,
    double TemperatureMaxC,
    double TemperatureMinC,
    int? PrecipitationProbability,  // percent; null for seasonal (the archive gives totals, not a chance)
    int WeatherCode,                // WMO weather code — the client maps it to an icon + localized label
    WeatherSource Source);

public enum WeatherSource
{
    // A real forecast (the date falls within the provider's ~16-day forecast window).
    Forecast,

    // A seasonal estimate from the historical archive for the same calendar dates a year back — used
    // when the trip is further out than the forecast window reaches (or already in the past).
    Seasonal,
}
