using Explivio.API.Modules.Trips.GetConditions;
using Xunit;

namespace Explivio.API.Tests;

// F28: the offline time-zone → local-currency heuristic that powers "currency awareness".
public sealed class DestinationCurrencyTests
{
    [Theory]
    [InlineData("Europe/Lisbon", "EUR")]
    [InlineData("Europe/London", "GBP")]
    [InlineData("America/New_York", "USD")]
    [InlineData("Asia/Tokyo", "JPY")]
    [InlineData("Europe/zurich", "CHF")] // case-insensitive
    public void Resolves_known_time_zones_to_their_currency(string timeZone, string expected)
    {
        Assert.Equal(expected, DestinationCurrency.ForTimeZone(timeZone));
    }

    [Theory]
    [InlineData("Antarctica/McMurdo")]
    [InlineData("Not/AZone")]
    [InlineData(null)]
    public void Unknown_or_missing_time_zone_yields_null(string? timeZone)
    {
        Assert.Null(DestinationCurrency.ForTimeZone(timeZone));
    }
}
