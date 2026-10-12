using System.ClientModel;
using Microsoft.Extensions.AI;
using OpenAI;

namespace Explivio.API.Infrastructure.Rag;

// F14: registers the retrieval-augmented-generation pieces. The embedding generator is gated exactly
// like the chat client (AiServiceCollectionExtensions): a real OpenAI-compatible embedder when
// AI:Endpoint + AI:ApiKey are set, otherwise the deterministic fake — so RAG runs with no credentials
// or cost. The retriever is in-memory here; the Cosmos-backed retriever and seeder are added
// separately when a Cosmos connection is configured (see Program.cs / AddExplivioCosmosRag).
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
        var endpoint = configuration["AI:Endpoint"];
        var apiKey = configuration["AI:ApiKey"];
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
