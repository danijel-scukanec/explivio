namespace Explivio.API.Infrastructure.Rag;

// F14: retrieves the places most relevant to a query within a destination, by vector similarity.
// Two implementations: CosmosPlaceRetriever (vector search in Cosmos) when a Cosmos connection is
// configured, and InMemoryPlaceRetriever (cosine over the seeded corpus) otherwise — so grounding
// works locally and in tests with no Cosmos.
public interface IPlaceRetriever
{
    Task<IReadOnlyList<PlaceMatch>> RetrieveAsync(
        string destination, string query, int topK, CancellationToken cancellationToken);
}

// A retrieved place, trimmed to what the model needs as grounding.
public sealed record PlaceMatch(string Name, string Category, string Text);
