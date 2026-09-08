using System.ClientModel;
using Microsoft.Extensions.AI;
using OpenAI;

namespace Explivio.API.Infrastructure.Ai;

// F12: registers the IChatClient the AI features depend on. Gated like the other external resources:
// a real client only when an endpoint + key are configured, otherwise the deterministic dev stub —
// so the app builds, runs, and tests pass with no credentials and no cost.
public static class AiServiceCollectionExtensions
{
    public static IServiceCollection AddExplivioAi(this IServiceCollection services, IConfiguration configuration)
    {
        var endpoint = configuration["AI:Endpoint"];
        var apiKey = configuration["AI:ApiKey"];
        var model = configuration["AI:Model"] ?? "gpt-4o-mini";

        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey))
        {
            // No provider configured — use the stub. Real generation is opt-in via config.
            services.AddChatClient(new FakeItineraryChatClient());
            return services;
        }

        // An OpenAI-compatible endpoint covers Azure OpenAI, GitHub Models, and OpenAI itself; only
        // the endpoint, key, and model name change. The client is created per resolution but is cheap
        // and thread-safe to reuse via the singleton IChatClient registration below.
        services.AddChatClient(_ =>
        {
            var options = new OpenAIClientOptions { Endpoint = new Uri(endpoint) };
            var client = new OpenAIClient(new ApiKeyCredential(apiKey), options);
            return client.GetChatClient(model).AsIChatClient();
        });

        return services;
    }
}
