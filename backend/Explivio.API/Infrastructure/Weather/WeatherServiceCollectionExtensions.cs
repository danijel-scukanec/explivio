namespace Explivio.API.Infrastructure.Weather;

// F28: registers the weather provider. Like the FX integration there is no secret or gating —
// Open-Meteo is a public GET — so the real provider is always registered. Tests replace it with a
// deterministic fake via ConfigureTestServices, keeping CI offline and repeatable.
public static class WeatherServiceCollectionExtensions
{
    public static IServiceCollection AddExplivioWeather(this IServiceCollection services)
    {
        services.AddMemoryCache();

        // Typed client with no base address — the provider talks to two Open-Meteo hosts (forecast +
        // archive) via absolute URLs. ServiceDefaults' ConfigureHttpClientDefaults still adds the
        // standard resilience handler (retry + timeout + circuit breaker) and HttpClient telemetry.
        services.AddHttpClient<IWeatherProvider, OpenMeteoWeatherProvider>();

        return services;
    }
}
