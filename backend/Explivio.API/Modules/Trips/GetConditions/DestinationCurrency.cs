namespace Explivio.API.Modules.Trips.GetConditions;

// F28: resolves a destination's local currency (ISO 4217) from its IANA time zone. The time zone
// comes free with the weather lookup (Open-Meteo's timezone=auto), so this keeps "currency
// awareness" keyless and offline rather than adding a second reverse-geocoding call. It's a curated
// heuristic — a time zone usually maps cleanly to one country and currency — covering common travel
// destinations; an unknown zone yields null and the UI simply omits the local-currency line. The
// live base→local rate itself is layered on top via the existing F25 FX provider.
public static class DestinationCurrency
{
    private static readonly IReadOnlyDictionary<string, string> ByTimeZone =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // Eurozone
            ["Europe/Lisbon"] = "EUR",
            ["Europe/Madrid"] = "EUR",
            ["Europe/Paris"] = "EUR",
            ["Europe/Berlin"] = "EUR",
            ["Europe/Brussels"] = "EUR",
            ["Europe/Amsterdam"] = "EUR",
            ["Europe/Rome"] = "EUR",
            ["Europe/Vienna"] = "EUR",
            ["Europe/Dublin"] = "EUR",
            ["Europe/Athens"] = "EUR",
            ["Europe/Helsinki"] = "EUR",
            ["Europe/Tallinn"] = "EUR",
            ["Europe/Riga"] = "EUR",
            ["Europe/Vilnius"] = "EUR",
            ["Europe/Bratislava"] = "EUR",
            ["Europe/Ljubljana"] = "EUR",
            ["Europe/Luxembourg"] = "EUR",
            ["Europe/Malta"] = "EUR",
            ["Europe/Zagreb"] = "EUR",  // Croatia adopted the euro in 2023

            // Rest of Europe
            ["Europe/London"] = "GBP",
            ["Europe/Zurich"] = "CHF",
            ["Europe/Oslo"] = "NOK",
            ["Europe/Stockholm"] = "SEK",
            ["Europe/Copenhagen"] = "DKK",
            ["Europe/Prague"] = "CZK",
            ["Europe/Warsaw"] = "PLN",
            ["Europe/Budapest"] = "HUF",
            ["Europe/Bucharest"] = "RON",
            ["Europe/Sofia"] = "BGN",
            ["Europe/Istanbul"] = "TRY",
            ["Europe/Moscow"] = "RUB",
            ["Europe/Kyiv"] = "UAH",
            ["Atlantic/Reykjavik"] = "ISK",

            // Americas
            ["America/New_York"] = "USD",
            ["America/Chicago"] = "USD",
            ["America/Denver"] = "USD",
            ["America/Los_Angeles"] = "USD",
            ["America/Phoenix"] = "USD",
            ["America/Anchorage"] = "USD",
            ["Pacific/Honolulu"] = "USD",
            ["America/Toronto"] = "CAD",
            ["America/Vancouver"] = "CAD",
            ["America/Mexico_City"] = "MXN",
            ["America/Sao_Paulo"] = "BRL",
            ["America/Buenos_Aires"] = "ARS",
            ["America/Argentina/Buenos_Aires"] = "ARS",
            ["America/Santiago"] = "CLP",
            ["America/Bogota"] = "COP",
            ["America/Lima"] = "PEN",

            // Asia-Pacific
            ["Asia/Tokyo"] = "JPY",
            ["Asia/Shanghai"] = "CNY",
            ["Asia/Hong_Kong"] = "HKD",
            ["Asia/Singapore"] = "SGD",
            ["Asia/Seoul"] = "KRW",
            ["Asia/Bangkok"] = "THB",
            ["Asia/Jakarta"] = "IDR",
            ["Asia/Kuala_Lumpur"] = "MYR",
            ["Asia/Manila"] = "PHP",
            ["Asia/Ho_Chi_Minh"] = "VND",
            ["Asia/Kolkata"] = "INR",
            ["Asia/Dubai"] = "AED",
            ["Asia/Jerusalem"] = "ILS",
            ["Asia/Taipei"] = "TWD",
            ["Australia/Sydney"] = "AUD",
            ["Australia/Melbourne"] = "AUD",
            ["Australia/Perth"] = "AUD",
            ["Pacific/Auckland"] = "NZD",

            // Africa
            ["Africa/Cairo"] = "EGP",
            ["Africa/Johannesburg"] = "ZAR",
            ["Africa/Casablanca"] = "MAD",
            ["Africa/Nairobi"] = "KES",
            ["Africa/Lagos"] = "NGN",
        };

    // The local currency for a time zone, or null when the zone isn't in the table.
    public static string? ForTimeZone(string? timeZoneId) =>
        timeZoneId is not null && ByTimeZone.TryGetValue(timeZoneId, out var currency) ? currency : null;
}
