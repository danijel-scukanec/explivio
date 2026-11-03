using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Explivio.API.Infrastructure.AiOps;

// F21: accumulates AI usage (calls, tokens, estimated cost, cache hits) per feature + model, and also
// emits it as OpenTelemetry counters so the same numbers show up in the Aspire dashboard / Azure
// Monitor. In-memory and process-lifetime (a singleton) — the usage endpoint reads Snapshot(). Good
// enough for an ops view; persisting history would be a later step.
public interface IAiUsageTracker
{
    void Record(string feature, string model, long inputTokens, long outputTokens, decimal estimatedCost, bool cacheHit);
    AiUsageSnapshot Snapshot();
}

public sealed class AiUsageTracker : IAiUsageTracker, IDisposable
{
    private readonly object _gate = new();
    private readonly Dictionary<(string Feature, string Model), Counters> _rows = new();

    private readonly Meter _meter = new(AiOpsConstants.Meter);
    private readonly Counter<long> _calls;
    private readonly Counter<long> _cacheHits;
    private readonly Counter<long> _tokens;
    private readonly Counter<double> _cost;

    public AiUsageTracker()
    {
        _calls = _meter.CreateCounter<long>("explivio.ai.calls", unit: "{call}", description: "AI chat calls");
        _cacheHits = _meter.CreateCounter<long>("explivio.ai.cache.hits", unit: "{hit}", description: "Semantic-cache hits");
        _tokens = _meter.CreateCounter<long>("explivio.ai.tokens", unit: "{token}", description: "AI tokens used");
        _cost = _meter.CreateCounter<double>("explivio.ai.cost", unit: "USD", description: "Estimated AI cost");
    }

    public void Record(string feature, string model, long inputTokens, long outputTokens, decimal estimatedCost, bool cacheHit)
    {
        lock (_gate)
        {
            var key = (feature, model);
            if (!_rows.TryGetValue(key, out var c)) _rows[key] = c = new Counters();
            c.Calls++;
            if (cacheHit) c.CacheHits++;
            c.InputTokens += inputTokens;
            c.OutputTokens += outputTokens;
            c.EstimatedCost += estimatedCost;
        }

        var tags = new TagList { { "feature", feature }, { "model", model } };
        _calls.Add(1, tags);
        if (cacheHit) _cacheHits.Add(1, tags);
        if (inputTokens > 0) _tokens.Add(inputTokens, new TagList { { "feature", feature }, { "model", model }, { "direction", "input" } });
        if (outputTokens > 0) _tokens.Add(outputTokens, new TagList { { "feature", feature }, { "model", model }, { "direction", "output" } });
        if (estimatedCost > 0) _cost.Add((double)estimatedCost, tags);
    }

    public AiUsageSnapshot Snapshot()
    {
        lock (_gate)
        {
            var rows = _rows
                .Select(kv => new AiUsageRow(
                    kv.Key.Feature, kv.Key.Model, kv.Value.Calls, kv.Value.CacheHits,
                    kv.Value.InputTokens, kv.Value.OutputTokens, kv.Value.EstimatedCost))
                .OrderByDescending(r => r.EstimatedCost).ThenByDescending(r => r.Calls)
                .ToList();

            var total = new AiUsageRow(
                "Total", "",
                rows.Sum(r => r.Calls), rows.Sum(r => r.CacheHits),
                rows.Sum(r => r.InputTokens), rows.Sum(r => r.OutputTokens), rows.Sum(r => r.EstimatedCost));

            return new AiUsageSnapshot(total, rows);
        }
    }

    public void Dispose() => _meter.Dispose();

    private sealed class Counters
    {
        public long Calls;
        public long CacheHits;
        public long InputTokens;
        public long OutputTokens;
        public decimal EstimatedCost;
    }
}

// One row of usage, per feature + model (model empty on the Total row).
public sealed record AiUsageRow(
    string Feature, string Model, long Calls, long CacheHits,
    long InputTokens, long OutputTokens, decimal EstimatedCost);

public sealed record AiUsageSnapshot(AiUsageRow Total, IReadOnlyList<AiUsageRow> Rows);
