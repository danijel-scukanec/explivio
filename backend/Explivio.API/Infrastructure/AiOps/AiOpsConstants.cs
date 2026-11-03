namespace Explivio.API.Infrastructure.AiOps;

// F21: names for the AI-ops OpenTelemetry instrumentation. The Microsoft.Extensions.AI OpenTelemetry
// middleware emits under its own experimental source; our custom usage/cost metrics use the Explivio
// meter. Both are registered with the OTel pipeline in ServiceDefaults so they reach the dashboard.
public static class AiOpsConstants
{
    // The source/meter name Microsoft.Extensions.AI's UseOpenTelemetry() emits under.
    public const string MeaiSource = "Experimental.Microsoft.Extensions.AI";

    // Our own meter for token/cost/cache counters, attributed per feature + model.
    public const string Meter = "Explivio.AiOps";
}
