using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.Rag;

// F14: a deterministic stand-in for a real embedding model, used when no AI provider is configured —
// the same gating idea as FakeItineraryChatClient. It maps text to a fixed-width vector by hashing
// each word into a bucket, so texts that share words land near each other in vector space. That makes
// similarity search meaningful offline (a "food market" query ranks food places above museums)
// without any credentials, cost, or network. Not a real semantic model — a dev stub for the RAG path.
public sealed class FakePlaceEmbeddingGenerator : IEmbeddingGenerator<string, Embedding<float>>
{
    public Task<GeneratedEmbeddings<Embedding<float>>> GenerateAsync(
        IEnumerable<string> values,
        EmbeddingGenerationOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var embeddings = values
            .Select(v => new Embedding<float>(Embed(v)))
            .ToList();

        return Task.FromResult(new GeneratedEmbeddings<Embedding<float>>(embeddings));
    }

    private static float[] Embed(string text)
    {
        var vector = new float[RagConstants.EmbeddingDimensions];

        foreach (var token in Tokenize(text))
        {
            var bucket = (int)(Fnv1a(token) % RagConstants.EmbeddingDimensions);
            vector[bucket] += 1f;
        }

        return Vectors.Normalize(vector);
    }

    private static IEnumerable<string> Tokenize(string text)
    {
        var current = new List<char>();
        foreach (var c in text)
        {
            if (char.IsLetterOrDigit(c))
            {
                current.Add(char.ToLowerInvariant(c));
            }
            else if (current.Count > 0)
            {
                yield return new string(current.ToArray());
                current.Clear();
            }
        }

        if (current.Count > 0)
        {
            yield return new string(current.ToArray());
        }
    }

    // FNV-1a: a stable hash that is identical across processes and runs, unlike string.GetHashCode,
    // so the fake embeddings are reproducible (which the unit tests rely on).
    private static uint Fnv1a(string token)
    {
        const uint offset = 2166136261;
        const uint prime = 16777619;

        var hash = offset;
        foreach (var c in token)
        {
            hash ^= c;
            hash *= prime;
        }

        return hash;
    }

    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose()
    {
    }
}
