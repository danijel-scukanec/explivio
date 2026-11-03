namespace Explivio.API.Infrastructure.AiOps;

// F21: a lightweight ambient scope naming the feature behind an AI call (e.g. "ItineraryGeneration",
// "TripRecap", "ReceiptScan"). An AI entry point opens a scope before invoking IChatClient; the usage
// tracker in the pipeline reads Current to attribute tokens/cost to the right feature. AsyncLocal so
// it flows through the async call chain without threading a parameter through every layer.
public static class AiFeatureScope
{
    private static readonly AsyncLocal<string?> CurrentFeature = new();

    public static string Current => CurrentFeature.Value ?? "Unknown";

    // Opens a scope; dispose restores the previous value (scopes can nest harmlessly).
    public static IDisposable Push(string feature)
    {
        var previous = CurrentFeature.Value;
        CurrentFeature.Value = feature;
        return new Scope(previous);
    }

    private sealed class Scope(string? previous) : IDisposable
    {
        public void Dispose() => CurrentFeature.Value = previous;
    }
}
