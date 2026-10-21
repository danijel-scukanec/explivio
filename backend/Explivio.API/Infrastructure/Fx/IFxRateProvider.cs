namespace Explivio.API.Infrastructure.Fx;

// F25: supplies exchange rates for converting expenses into a trip's base currency. Abstracted
// behind an interface — same posture as the AI/RAG integrations — so the budget handlers depend on
// a contract, not on the HTTP client, and tests can inject a deterministic fake (no network in CI).
public interface IFxRateProvider
{
    // Returns the rates for one base currency: base → quote (1 unit of base buys rate[quote] of quote),
    // which is the shape the frankfurter API returns. Null when rates can't be fetched and nothing is
    // cached — callers degrade gracefully rather than reporting a wrong total.
    Task<FxRates?> GetRatesAsync(string baseCurrency, CancellationToken cancellationToken);
}

// A snapshot of exchange rates for one base currency, as of a given day. Rates map a 3-letter quote
// currency code to how much of it one unit of the base buys.
public sealed record FxRates(string Base, DateOnly AsOf, IReadOnlyDictionary<string, decimal> Rates)
{
    // Converts an amount expressed in `fromCurrency` into this snapshot's base currency. Same currency
    // is identity; an unknown quote currency yields null so the caller can flag it rather than guess.
    public decimal? ToBase(decimal amount, string fromCurrency)
    {
        if (string.Equals(fromCurrency, Base, StringComparison.OrdinalIgnoreCase))
            return amount;

        // frankfurter gives base→quote, so 1 base = rate[from] of `from`; therefore
        // amount of `from` is amount / rate[from] of base.
        return Rates.TryGetValue(fromCurrency.ToUpperInvariant(), out var rate) && rate != 0
            ? decimal.Round(amount / rate, 2, MidpointRounding.AwayFromZero)
            : null;
    }
}
