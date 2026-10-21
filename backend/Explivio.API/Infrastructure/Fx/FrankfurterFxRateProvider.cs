using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;

namespace Explivio.API.Infrastructure.Fx;

// F25: live exchange rates from frankfurter.dev (ECB reference rates; keyless, free). Rates move at
// most once a business day, so each base's snapshot is cached for a day — the typical trip budget
// view makes one outbound call and then reads cache. The HttpClient gets retries, a timeout and a
// circuit breaker for free from ServiceDefaults' standard resilience handler.
public sealed class FrankfurterFxRateProvider(
    HttpClient httpClient,
    IMemoryCache cache,
    ILogger<FrankfurterFxRateProvider> logger) : IFxRateProvider
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(12);

    public async Task<FxRates?> GetRatesAsync(string baseCurrency, CancellationToken cancellationToken)
    {
        var @base = baseCurrency.ToUpperInvariant();
        var cacheKey = $"fx:{@base}";

        if (cache.TryGetValue<FxRates>(cacheKey, out var cached) && cached is not null)
            return cached;

        try
        {
            // The resilience handler wraps this call; a persistent failure surfaces here and we fall
            // through to the degraded (null) path rather than failing the whole budget request.
            var dto = await httpClient.GetFromJsonAsync<FrankfurterResponse>(
                $"v1/latest?base={@base}", cancellationToken);

            if (dto is null || dto.Rates.Count == 0)
                return null;

            var rates = new FxRates(dto.Base, dto.Date, dto.Rates);
            cache.Set(cacheKey, rates, CacheTtl);
            return rates;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            // Degrade: the budget summary still renders per-currency subtotals and flags that
            // conversion is unavailable. Not an application error, so we log and move on.
            logger.LogWarning(ex, "Could not fetch FX rates for base {Base}; conversion unavailable.", @base);
            return null;
        }
    }

    // Shape of https://api.frankfurter.dev/v1/latest?base=XXX
    private sealed record FrankfurterResponse(
        [property: JsonPropertyName("base")] string Base,
        [property: JsonPropertyName("date")] DateOnly Date,
        [property: JsonPropertyName("rates")] Dictionary<string, decimal> Rates);
}
