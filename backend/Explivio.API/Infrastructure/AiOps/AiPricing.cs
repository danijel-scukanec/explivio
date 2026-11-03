namespace Explivio.API.Infrastructure.AiOps;

// F21: per-model token prices (USD per 1,000,000 tokens), bound from the "AI:Pricing" config section
// so rates can be tuned without a rebuild. Cost is an estimate — the authoritative bill is Azure's —
// but it's enough to surface relative spend per feature/model in the usage view and as a metric.
public sealed class AiPricing
{
    // model name -> rates. Keys are case-insensitive via the lookup below.
    public Dictionary<string, ModelRate> Models { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public decimal EstimateCost(string model, long inputTokens, long outputTokens)
    {
        if (!Models.TryGetValue(model, out var rate)) return 0m;
        return (inputTokens / 1_000_000m) * rate.InputPerMillion
             + (outputTokens / 1_000_000m) * rate.OutputPerMillion;
    }

    public sealed class ModelRate
    {
        public decimal InputPerMillion { get; set; }
        public decimal OutputPerMillion { get; set; }
    }
}
