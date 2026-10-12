using System.Text.Json.Serialization;

namespace Explivio.API.Infrastructure.Rag;

// F14: a place in the RAG corpus — a real point of interest whose description is embedded and stored
// for similarity search. The document lives in the Cosmos "places" container, partitioned by
// Destination so a retrieval only scans the relevant city. The same type backs the in-memory
// retriever used when Cosmos isn't configured.
public sealed class Place
{
    // Cosmos requires a lowercase "id"; derived from destination + name when seeding.
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    // Partition key. A normalized city name (e.g. "Lisbon").
    public string Destination { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;

    // The descriptive text that gets embedded and shown to the model as grounding.
    public string Text { get; set; } = string.Empty;

    // The embedding vector of Text, RagConstants.EmbeddingDimensions long.
    public float[] Embedding { get; set; } = [];
}
