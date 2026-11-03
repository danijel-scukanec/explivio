using System.ClientModel;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using OpenAI;

namespace Explivio.Evals;

// F21: builds the real chat client the evals run against, from the same AI:* config the API uses
// (user-secrets + env). Returns null when no model is configured, so evals skip rather than fail in
// CI / offline — evals assert output quality and only make sense against a real model.
public static class EvalModel
{
    private static readonly IConfiguration Config = new ConfigurationBuilder()
        .AddUserSecrets(typeof(EvalModel).Assembly, optional: true)
        .AddEnvironmentVariables()
        .Build();

    public static string Model => Config["AI:Model"] ?? "gpt-4o-mini";

    public static IChatClient? TryCreate()
    {
        var endpoint = Config["AI:Endpoint"];
        var apiKey = Config["AI:ApiKey"];
        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey)) return null;

        var client = new OpenAIClient(new ApiKeyCredential(apiKey), new OpenAIClientOptions { Endpoint = new Uri(endpoint) });
        return client.GetChatClient(Model).AsIChatClient();
    }
}
