namespace Explivio.API.Infrastructure.Fx;

// F25: registers the FX rate provider. Unlike the AI/Cosmos integrations there is no secret or
// gating — frankfurter is a public GET — so the real provider is always registered. Tests replace it
// with a deterministic fake via ConfigureTestServices, keeping CI offline and repeatable.
public static class FxServiceCollectionExtensions
{
    public static IServiceCollection AddExplivioFx(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddMemoryCache();

        var baseUrl = configuration["Fx:BaseUrl"] ?? "https://api.frankfurter.dev/";

        // Typed client: ServiceDefaults' ConfigureHttpClientDefaults adds the standard resilience
        // handler (retry + timeout + circuit breaker) and HttpClient OpenTelemetry to every client.
        services.AddHttpClient<IFxRateProvider, FrankfurterFxRateProvider>(client =>
            client.BaseAddress = new Uri(baseUrl));

        return services;
    }
}
