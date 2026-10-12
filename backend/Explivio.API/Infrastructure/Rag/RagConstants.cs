namespace Explivio.API.Infrastructure.Rag;

// F14: shared constants for the RAG (retrieval-augmented generation) pieces. The embedding dimension
// must match on both sides: the generator produces vectors of this size and the Cosmos container's
// vector policy is declared with it. text-embedding-3-small (the default real model) is 1536, and the
// deterministic fake generator produces the same width so the two are interchangeable without a
// container change. Override AI:EmbeddingDimensions only alongside a model of a different width.
public static class RagConstants
{
    public const int EmbeddingDimensions = 1536;
    public const string DatabaseName = "explivio";
    public const string PlacesContainer = "places";
}
