using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.Rag;

// F14: the retriever used when Cosmos is configured. It embeds the query and runs the nearest-place
// search in the database with Cosmos's VectorDistance over the DiskANN-indexed "embedding" vector,
// so similarity ranking happens server-side rather than in process (the InMemoryPlaceRetriever is the
// equivalent for the no-Cosmos path). Destinations are matched leniently with CONTAINS — the same
// rule as DestinationMatch — so "Lisbon, Portugal" still finds the "Lisbon" places.
//
// Retrieval is best-effort: if the store isn't seeded yet, is slow, or errors, it returns no matches
// so generation proceeds ungrounded. The RAG layer only ever adds context — it must never block or
// fail a generation — and a short timeout keeps a slow store from tying up the request thread.
public sealed class CosmosPlaceRetriever(
    CosmosClient client,
    IEmbeddingGenerator<string, Embedding<float>> embeddingGenerator,
    ILogger<CosmosPlaceRetriever> logger) : IPlaceRetriever
{
    private static readonly TimeSpan QueryTimeout = TimeSpan.FromSeconds(5);

    public async Task<IReadOnlyList<PlaceMatch>> RetrieveAsync(
        string destination, string query, int topK, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(QueryTimeout);
        var ct = timeout.Token;

        try
        {
            var embedding = await embeddingGenerator.GenerateAsync([query], cancellationToken: ct);
            var queryVector = embedding[0].Vector.ToArray();

            var container = client.GetContainer(RagConstants.DatabaseName, RagConstants.PlacesContainer);

            var sql = """
                SELECT c.name AS name, c.category AS category, c.text AS text
                FROM c
                WHERE CONTAINS(@destination, c.destination, true)
                ORDER BY VectorDistance(c.embedding, @vector)
                OFFSET 0 LIMIT @k
                """;

            var queryDefinition = new QueryDefinition(sql)
                .WithParameter("@destination", destination)
                .WithParameter("@vector", queryVector)
                .WithParameter("@k", topK);

            var matches = new List<PlaceMatch>();
            using var iterator = container.GetItemQueryIterator<PlaceMatch>(queryDefinition);
            while (iterator.HasMoreResults)
            {
                foreach (var match in await iterator.ReadNextAsync(ct))
                {
                    matches.Add(match);
                }
            }

            return matches;
        }
        catch (Exception ex) when (ex is CosmosException or OperationCanceledException or TimeoutException)
        {
            // Best-effort: fall back to ungrounded generation rather than failing the request.
            logger.LogWarning(ex, "Cosmos place retrieval failed or timed out; generating without grounding.");
            return [];
        }
    }
}
