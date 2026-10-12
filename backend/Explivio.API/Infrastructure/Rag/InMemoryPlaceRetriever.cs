using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.Rag;

// F14: the retriever used when Cosmos isn't configured (plain `dotnet run`, tests). It embeds the
// seed corpus once on first use and ranks places by cosine similarity to the query, filtered to the
// destination. This keeps grounding fully working locally and in CI without a Cosmos emulator; the
// CosmosPlaceRetriever is the equivalent that runs the similarity in the database when deployed.
public sealed class InMemoryPlaceRetriever(
    PlaceCorpus corpus,
    IEmbeddingGenerator<string, Embedding<float>> embeddingGenerator) : IPlaceRetriever
{
    private readonly SemaphoreSlim initLock = new(1, 1);
    private IReadOnlyList<Place>? embedded;

    public async Task<IReadOnlyList<PlaceMatch>> RetrieveAsync(
        string destination, string query, int topK, CancellationToken cancellationToken)
    {
        var places = await EnsureEmbeddedAsync(cancellationToken);

        var candidates = places
            .Where(p => DestinationMatch.Matches(destination, p.Destination))
            .ToList();

        if (candidates.Count == 0)
        {
            return [];
        }

        var queryVector = await EmbedAsync(query, cancellationToken);

        return candidates
            .Select(p => (Place: p, Score: Vectors.CosineSimilarity(queryVector, p.Embedding)))
            .OrderByDescending(x => x.Score)
            .Take(topK)
            .Select(x => new PlaceMatch(x.Place.Name, x.Place.Category, x.Place.Text))
            .ToList();
    }

    private async Task<IReadOnlyList<Place>> EnsureEmbeddedAsync(CancellationToken cancellationToken)
    {
        if (embedded is not null)
        {
            return embedded;
        }

        await initLock.WaitAsync(cancellationToken);
        try
        {
            if (embedded is null)
            {
                var places = corpus.Places;
                var vectors = await embeddingGenerator.GenerateAsync(
                    places.Select(p => p.Text), cancellationToken: cancellationToken);

                for (var i = 0; i < places.Count; i++)
                {
                    places[i].Embedding = vectors[i].Vector.ToArray();
                }

                embedded = places;
            }
        }
        finally
        {
            initLock.Release();
        }

        return embedded;
    }

    private async Task<float[]> EmbedAsync(string text, CancellationToken cancellationToken)
    {
        var result = await embeddingGenerator.GenerateAsync([text], cancellationToken: cancellationToken);
        return result[0].Vector.ToArray();
    }
}
