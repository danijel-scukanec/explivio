using Explivio.API.Infrastructure.Fx;
using Xunit;

namespace Explivio.API.Tests;

public sealed class FxRatesTests
{
    // base→quote rates, as frankfurter returns them: 1 EUR = 1.10 USD = 0.85 GBP.
    private static FxRates EurRates() => new("EUR", new DateOnly(2026, 1, 1),
        new Dictionary<string, decimal> { ["USD"] = 1.10m, ["GBP"] = 0.85m });

    [Fact]
    public void Same_currency_as_base_is_identity()
    {
        var rates = EurRates();
        Assert.Equal(42.50m, rates.ToBase(42.50m, "EUR"));
        Assert.Equal(42.50m, rates.ToBase(42.50m, "eur")); // case-insensitive
    }

    [Fact]
    public void Converts_quote_currency_into_base()
    {
        var rates = EurRates();
        // 110 USD / 1.10 = 100 EUR; 85 GBP / 0.85 = 100 EUR.
        Assert.Equal(100m, rates.ToBase(110m, "USD"));
        Assert.Equal(100m, rates.ToBase(85m, "GBP"));
    }

    [Fact]
    public void Unknown_currency_returns_null()
    {
        var rates = EurRates();
        Assert.Null(rates.ToBase(100m, "JPY"));
    }

    [Fact]
    public void Result_is_rounded_to_two_decimals()
    {
        var rates = EurRates();
        // 33.33 USD / 1.10 = 30.3 → 30.30 (rounded, away from zero).
        Assert.Equal(30.30m, rates.ToBase(33.33m, "USD"));
    }
}
