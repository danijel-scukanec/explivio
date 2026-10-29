using System.ClientModel;
using Microsoft.Extensions.AI;
using OpenAI;

namespace Explivio.API.Infrastructure.Rag;

// F14: registers the retrieval-augmented-generation pieces. Embeddings are a SEPARATE capability from
// chat: not every chat provider offers an embeddings API (e.g. Groq is chat-only), so a real embedder
// is used only when a dedicated AI:EmbeddingEndpoint is configured — otherwise the deterministic fake,
// which keeps RAG working with no credentials or cost regardless of which chat model is wired. The
// retriever is in-memory here; the Cosmos-backed retriever and seeder are added separately when a
// Cosmos connection is configured (see Program.cs / AddExplivioCosmosRag).
public static class RagServiceCollectionExtensions
{
    public static IServiceCollection AddExplivioRag(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<PlaceCorpus>();
        services.AddSingleton(_ => CreateEmbeddingGenerator(configuration));

        // Default (no Cosmos): similarity search over the seeded corpus in memory. The Cosmos path
        // replaces this registration when a connection is configured.
        services.AddSingleton<IPlaceRetriever, InMemoryPlaceRetriever>();

        services.AddScoped<IItineraryGroundingProvider, ItineraryGroundingProvider>();

        return services;
    }

    private static IEmbeddingGenerator<string, Embedding<float>> CreateEmbeddingGenerator(IConfiguration configuration)
    {
        // A real embedder needs its OWN endpoint — reusing the chat AI:Endpoint would point embeddings
        // at a chat-only provider (Groq) that has no embeddings API. The key falls back to AI:ApiKey
        // when one credential covers both (OpenAI/Azure).
        var endpoint = configuration["AI:EmbeddingEndpoint"];
        var apiKey = configuration["AI:EmbeddingApiKey"] ?? configuration["AI:ApiKey"];
        var model = configuration["AI:EmbeddingModel"] ?? "text-embedding-3-small";

        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey))
        {
            return new FakePlaceEmbeddingGenerator();
        }

        var options = new OpenAIClientOptions { Endpoint = new Uri(endpoint) };
        var client = new OpenAIClient(new ApiKeyCredential(apiKey), options);
        return client.GetEmbeddingClient(model).AsIEmbeddingGenerator();
    }
}
