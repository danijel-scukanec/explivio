using Explivio.API.Infrastructure.Fx;

namespace Explivio.IntegrationTests;

// F25: a deterministic FX provider for integration tests — fixed rates, no network. Rates are quoted
// as base→quote (1 unit of base buys this many of the quote), the same shape frankfurter returns.
// Known rates relative to EUR; other bases are derived by inversion so the tests can use any base.
public sealed class FakeFxRateProvider : IFxRateProvider
{
    // 1 EUR = 1.10 USD = 0.85 GBP.
    private static readonly Dictionary<string, decimal> EurRates = new()
    {
        ["USD"] = 1.10m,
        ["GBP"] = 0.85m,
    };

    public Task<FxRates?> GetRatesAsync(string baseCurrency, CancellationToken cancellationToken)
    {
        var @base = baseCurrency.ToUpperInvariant();
        var rates = new Dictionary<string, decimal>();

        if (@base == "EUR")
        {
            foreach (var (k, v) in EurRates) rates[k] = v;
            rates["EUR"] = 1m;
        }
        else if (EurRates.TryGetValue(@base, out var baseToEur))
        {
            // Re-base: 1 base = (1/baseToEur) EUR, then EUR→each quote.
            var eurPerBase = 1m / baseToEur;
            rates["EUR"] = eurPerBase;
            foreach (var (quote, eurToQuote) in EurRates)
                rates[quote] = eurPerBase * eurToQuote;
            rates[@base] = 1m;
        }

        return Task.FromResult<FxRates?>(new FxRates(@base, new DateOnly(2026, 1, 1), rates));
    }
}
