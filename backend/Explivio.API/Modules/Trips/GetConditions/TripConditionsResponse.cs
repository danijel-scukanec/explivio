using Explivio.API.Infrastructure.Weather;

namespace Explivio.API.Modules.Trips.GetConditions;

// F28: destination conditions for a trip — per stop, the local time zone, the local currency with a
// live exchange rate against the trip's base currency, and per-day weather. Ties together the three
// strands of F28 (per-day weather + time-zone awareness + currency awareness) in one read.
public record TripConditionsResponse(
    string BaseCurrency,
    IReadOnlyList<StopConditions> Stops);

// Conditions for one stop on the route. Everything but the stop identity/place is nullable because a
// stop without coordinates (or when the weather provider is unavailable) still appears — just without
// resolved time zone / currency / weather.
public record StopConditions(
    Guid StopId,
    int Order,
    string Place,
    double? Latitude,
    double? Longitude,
    bool HasLocation,
    string? TimeZoneId,
    string? TimeZoneAbbreviation,
    int? UtcOffsetSeconds,
    string? LocalCurrency,
    // How much of LocalCurrency one unit of the trip's BaseCurrency buys (live, cached FX). Null when
    // the local currency equals the base currency, is unknown, or rates couldn't be fetched.
    decimal? LocalPerBaseUnit,
    bool WeatherAvailable,
    IReadOnlyList<DailyConditions> Days);

// One day's weather at a stop. Source is "Forecast" or "Seasonal" (a historical estimate for dates
// beyond the forecast window), serialized as a string by the global enum converter.
public record DailyConditions(
    DateOnly Date,
    double TemperatureMaxC,
    double TemperatureMinC,
    int? PrecipitationProbability,
    int WeatherCode,
    WeatherSource Source);
