using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Fx;
using Explivio.API.Infrastructure.Weather;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.GetConditions;

// F28: builds the destination-conditions view for a trip. For each stop with coordinates it fetches
// per-day weather + the local time zone from the weather provider, resolves the local currency from
// that time zone, and converts it against the trip's base currency using the existing (cached) FX
// rates. Everything degrades gracefully: a stop without coordinates — or one the weather provider
// can't reach — still appears, just without the resolved extras.
public class GetTripConditionsHandler(AppDbContext db, IWeatherProvider weather, IFxRateProvider fx)
    : IRequestHandler<GetTripConditionsQuery, TripConditionsResponse>
{
    // Weather is shown per stop, so a long open-ended stay is capped to a sensible window rather than
    // emitting dozens of days (and archive calls) for a trip with vague dates.
    private const int MaxDaysPerStop = 14;

    public async Task<TripConditionsResponse> Handle(GetTripConditionsQuery query, CancellationToken cancellationToken)
    {
        var trip = await db.Trips
            .AsNoTracking()
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == query.TripId, cancellationToken);

        if (trip is null)
            return new TripConditionsResponse("EUR", []);

        var baseCurrency = trip.BaseCurrency;

        // One FX snapshot for the whole view (base → local rates). Null degrades to "rate unavailable".
        var rates = await fx.GetRatesAsync(baseCurrency, cancellationToken);

        var stops = new List<StopConditions>();
        foreach (var stop in trip.Stops.OrderBy(s => s.Order))
        {
            if (stop.Latitude is not { } lat || stop.Longitude is not { } lon)
            {
                stops.Add(new StopConditions(
                    stop.Id, stop.Order, stop.Place, stop.Latitude, stop.Longitude,
                    HasLocation: false, null, null, null, null, null, WeatherAvailable: false, []));
                continue;
            }

            var start = stop.ArriveDate ?? trip.StartDate;
            var end = stop.DepartDate ?? trip.EndDate;
            if (end < start) end = start;
            if (end.DayNumber - start.DayNumber + 1 > MaxDaysPerStop)
                end = start.AddDays(MaxDaysPerStop - 1);

            var located = await weather.GetWeatherAsync(lat, lon, start, end, cancellationToken);

            var localCurrency = DestinationCurrency.ForTimeZone(located?.TimeZoneId);
            var localPerBaseUnit = ResolveRate(rates, baseCurrency, localCurrency);

            var days = located?.Days
                .Select(d => new DailyConditions(
                    d.Date, d.TemperatureMaxC, d.TemperatureMinC,
                    d.PrecipitationProbability, d.WeatherCode, d.Source))
                .ToList() ?? [];

            stops.Add(new StopConditions(
                stop.Id, stop.Order, stop.Place, lat, lon,
                HasLocation: true,
                located?.TimeZoneId,
                located?.TimeZoneAbbreviation,
                located?.UtcOffsetSeconds,
                localCurrency,
                localPerBaseUnit,
                WeatherAvailable: days.Count > 0,
                days));
        }

        return new TripConditionsResponse(baseCurrency, stops);
    }

    // base → local: frankfurter gives base→quote directly, so the rate is rates[local]. Null when the
    // local currency is the base, is unknown, rates are unavailable, or the quote isn't listed.
    private static decimal? ResolveRate(FxRates? rates, string baseCurrency, string? localCurrency)
    {
        if (rates is null || localCurrency is null ||
            string.Equals(localCurrency, baseCurrency, StringComparison.OrdinalIgnoreCase))
            return null;

        return rates.Rates.TryGetValue(localCurrency.ToUpperInvariant(), out var rate) && rate != 0
            ? decimal.Round(rate, 4, MidpointRounding.AwayFromZero)
            : null;
    }
}
