using System.ClientModel;
using Azure;
using Azure.AI.ContentSafety;
using Azure.AI.OpenAI;
using Azure.Identity;
using Explivio.API.Infrastructure.AiOps;
using Explivio.API.Infrastructure.Features;
using Microsoft.Extensions.AI;
using OpenAI;

namespace Explivio.API.Infrastructure.Ai;

// F12: registers the IChatClient the AI features depend on. Gated like the other external resources:
// a real client only when an endpoint + key are configured, otherwise the deterministic dev stub —
// so the app builds, runs, and tests pass with no credentials and no cost.
// F21: the chat client is now a pipeline — content safety, semantic cache, OpenTelemetry and usage
// tracking wrap whichever inner client (real or stub) is used, so AI-ops applies uniformly.
public static class AiServiceCollectionExtensions
{
    public static IServiceCollection AddExplivioAi(this IServiceCollection services, IConfiguration configuration)
    {
        var endpoint = configuration["AI:Endpoint"];
        var apiKey = configuration["AI:ApiKey"];
        var model = configuration["AI:Model"] ?? "gpt-4o-mini";

        // F21: AI-ops services. Pricing (for cost estimation) is bound from config; the usage tracker
        // is a process-lifetime singleton read by the usage endpoint and emitted as OTel metrics.
        var pricing = new AiPricing();
        configuration.GetSection("AI:Pricing").Bind(pricing.Models);
        services.AddSingleton(pricing);
        services.AddSingleton<IAiUsageTracker, AiUsageTracker>();

        // Flags are read from config at startup (toggling the pipeline needs a restart) — the same
        // FeatureManagement source the runtime RequireFeature filter uses.
        var cacheEnabled = configuration.GetValue<bool>($"FeatureManagement:{FeatureFlags.AiSemanticCache}");
        var safetyEnabled = configuration.GetValue<bool>($"FeatureManagement:{FeatureFlags.AiContentSafety}");

        if (safetyEnabled)
        {
            var csEndpoint = configuration["AI:ContentSafety:Endpoint"];
            var csKey = configuration["AI:ContentSafety:ApiKey"];
            var threshold = configuration.GetValue<int?>("AI:ContentSafety:Threshold") ?? 4;
            if (!string.IsNullOrWhiteSpace(csEndpoint) && !string.IsNullOrWhiteSpace(csKey))
            {
                var client = new ContentSafetyClient(new Uri(csEndpoint), new AzureKeyCredential(csKey));
                services.AddSingleton<IContentSafety>(new AzureContentSafety(client, threshold));
            }
            else
            {
                // No Azure resource configured — local keyword stand-in so the block path still works.
                services.AddSingleton<IContentSafety, KeywordContentSafety>();
            }
        }

        var cacheThreshold = configuration.GetValue<double?>("AI:SemanticCache:Threshold") ?? 0.95;

        // Build the pipeline. First .Use is outermost, so: usage tracking (sees the final response) →
        // content safety (blocks before anything) → semantic cache (serves before the model) →
        // OpenTelemetry (measures the real call) → function invocation → the inner client.
        var builder = string.IsNullOrWhiteSpace(endpoint)
            ? services.AddChatClient(new FakeItineraryChatClient())
            : services.AddChatClient(_ => CreateChatClient(endpoint!, apiKey, model));

        builder.Use((inner, sp) => new UsageTrackingChatClient(
            inner, sp.GetRequiredService<IAiUsageTracker>(), pricing, model));

        if (safetyEnabled)
        {
            builder.Use((inner, sp) => new ContentSafetyChatClient(
                inner, sp.GetRequiredService<IContentSafety>(),
                sp.GetRequiredService<ILogger<ContentSafetyChatClient>>()));
        }

        if (cacheEnabled)
        {
            builder.Use((inner, sp) => new SemanticCacheChatClient(
                inner, sp.GetRequiredService<IEmbeddingGenerator<string, Embedding<float>>>(),
                sp.GetRequiredService<ILogger<SemanticCacheChatClient>>(), cacheThreshold));
        }

        builder.UseOpenTelemetry();
        builder.UseFunctionInvocation();

        return services;
    }

    // A real chat client: API key when one is configured (local dev / non-Azure providers), otherwise
    // Azure OpenAI with the hosting identity (managed identity in Container Apps — no secret). The
    // endpoint value is shared between both; AzureOpenAIClient wants the account base URL, so the
    // OpenAI-compatible "/openai/v1" suffix (if present) is trimmed off.
    private static IChatClient CreateChatClient(string endpoint, string? apiKey, string model)
    {
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            var options = new OpenAIClientOptions { Endpoint = new Uri(endpoint) };
            var client = new OpenAIClient(new ApiKeyCredential(apiKey), options);
            return client.GetChatClient(model).AsIChatClient();
        }

        var azure = new AzureOpenAIClient(NormalizeAzureEndpoint(endpoint), new DefaultAzureCredential());
        return azure.GetChatClient(model).AsIChatClient();
    }

    // Azure OpenAI's native client expects the account root (https://<name>.openai.azure.com/), not the
    // "/openai/v1" OpenAI-compatibility path the key-based OpenAIClient uses.
    internal static Uri NormalizeAzureEndpoint(string endpoint)
    {
        var trimmed = endpoint.TrimEnd('/');
        if (trimmed.EndsWith("/openai/v1", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[..^"/openai/v1".Length];
        }

        return new Uri(trimmed + "/");
    }
}
