using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.AiOps;

// F21: the outermost pipeline stage — records every chat call's tokens + estimated cost against the
// ambient feature (AiFeatureScope). Reads the token usage from the response (non-streaming) or the
// final UsageContent update (streaming). A response marked by the semantic cache as a hit is recorded
// as a hit with zero new tokens/cost, since no model call happened.
public sealed class UsageTrackingChatClient(
    IChatClient inner, IAiUsageTracker tracker, AiPricing pricing, string model)
    : DelegatingChatClient(inner)
{
    internal const string CacheHitKey = "explivio.ai.cache_hit";

    public override async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var response = await base.GetResponseAsync(messages, options, cancellationToken);
        Record(response.Usage, response.AdditionalProperties?.ContainsKey(CacheHitKey) == true);
        return response;
    }

    public override async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        UsageDetails? usage = null;
        var cacheHit = false;
        await foreach (var update in base.GetStreamingResponseAsync(messages, options, cancellationToken))
        {
            foreach (var content in update.Contents)
                if (content is UsageContent u) usage = u.Details;
            if (update.AdditionalProperties?.ContainsKey(CacheHitKey) == true) cacheHit = true;
            yield return update;
        }
        Record(usage, cacheHit);
    }

    private void Record(UsageDetails? usage, bool cacheHit)
    {
        var feature = AiFeatureScope.Current;
        if (cacheHit)
        {
            tracker.Record(feature, model, 0, 0, 0m, cacheHit: true);
            return;
        }
        var input = usage?.InputTokenCount ?? 0;
        var output = usage?.OutputTokenCount ?? 0;
        tracker.Record(feature, model, input, output, pricing.EstimateCost(model, input, output), cacheHit: false);
    }
}
