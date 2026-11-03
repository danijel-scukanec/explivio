using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.AiOps;

// F21: a semantic response cache. Before a (non-streaming) chat call it embeds the last user message
// and compares it to earlier prompts; if one is similar enough (cosine >= threshold) it returns that
// cached response instead of calling the model — saving the tokens and the latency. Streaming calls
// pass straight through (the varied generation/assistant flows want a fresh answer, and are streamed).
// In-memory, bounded, process-lifetime. Added to the pipeline only when the AiSemanticCache flag is on.
public sealed class SemanticCacheChatClient(
    IChatClient inner,
    IEmbeddingGenerator<string, Embedding<float>> embeddings,
    ILogger<SemanticCacheChatClient> logger,
    double threshold) : DelegatingChatClient(inner)
{
    private const int MaxEntries = 256;
    private readonly object _gate = new();
    private readonly List<Entry> _entries = new();

    public override async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var key = LastUserText(messages);
        if (string.IsNullOrWhiteSpace(key))
            return await base.GetResponseAsync(messages, options, cancellationToken);

        float[] query;
        try
        {
            var result = await embeddings.GenerateAsync([key], cancellationToken: cancellationToken);
            query = result[0].Vector.ToArray();
        }
        catch (Exception ex)
        {
            // Never let the cache break a real call — embedding is best-effort.
            logger.LogWarning(ex, "Semantic cache embedding failed; bypassing cache.");
            return await base.GetResponseAsync(messages, options, cancellationToken);
        }

        lock (_gate)
        {
            foreach (var entry in _entries)
            {
                if (Cosine(query, entry.Embedding) >= threshold)
                {
                    // Mark so the usage tracker records a hit (zero new tokens) rather than a model call.
                    (entry.Response.AdditionalProperties ??= [])[UsageTrackingChatClient.CacheHitKey] = true;
                    return entry.Response;
                }
            }
        }

        var response = await base.GetResponseAsync(messages, options, cancellationToken);
        lock (_gate)
        {
            _entries.Add(new Entry(query, response));
            if (_entries.Count > MaxEntries) _entries.RemoveAt(0);
        }
        return response;
    }

    private static string? LastUserText(IEnumerable<ChatMessage> messages)
    {
        var user = messages.LastOrDefault(m => m.Role == ChatRole.User);
        return user?.Text;
    }

    private static double Cosine(float[] a, float[] b)
    {
        if (a.Length != b.Length || a.Length == 0) return 0;
        double dot = 0, na = 0, nb = 0;
        for (var i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        var denom = Math.Sqrt(na) * Math.Sqrt(nb);
        return denom == 0 ? 0 : dot / denom;
    }

    private sealed record Entry(float[] Embedding, ChatResponse Response);
}
