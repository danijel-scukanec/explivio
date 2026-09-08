using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.Ai;

// F12: a deterministic stand-in for a real chat model, used when no AI provider is configured
// (AI:Endpoint / AI:ApiKey absent). It lets the app build, run, and pass tests with no credentials
// and no cost — the same gating idea as SQL/Service Bus. It always returns the same small itinerary
// as JSON matching GeneratedItinerary; the structured-output helper deserializes it like a real reply.
// Only the itinerary use case is supported — this is a dev stub, not a general chat client.
public sealed class FakeItineraryChatClient : IChatClient
{
    // camelCase property names + string enum values so GetResponseAsync<GeneratedItinerary> (web JSON
    // defaults) deserializes it. The summary flags that this is the stub, not a real generation.
    private const string CannedItineraryJson =
        """
        {
          "summary": "Sample 2-day itinerary (AI stub — set AI:Endpoint and AI:ApiKey for real generation).",
          "activities": [
            { "day": 1, "name": "Old town walking tour", "description": "Get oriented with a morning stroll through the historic center.", "category": "Sightseeing", "suggestedStartTime": "09:00" },
            { "day": 1, "name": "Local market lunch", "description": "Sample regional dishes at the central food market.", "category": "Food", "suggestedStartTime": "13:00" },
            { "day": 2, "name": "City museum", "description": "Spend the morning at the main museum before it gets busy.", "category": "Sightseeing", "suggestedStartTime": "10:00" }
          ]
        }
        """;

    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var message = new ChatMessage(ChatRole.Assistant, CannedItineraryJson);
        return Task.FromResult(new ChatResponse(message));
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Emit the canned JSON in small chunks with a short delay so the streaming path (F13) behaves
        // like a real model — the client's progressive card reveal actually animates with no provider.
        const int chunkSize = 24;
        for (var i = 0; i < CannedItineraryJson.Length; i += chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var chunk = CannedItineraryJson.Substring(i, Math.Min(chunkSize, CannedItineraryJson.Length - i));
            yield return new ChatResponseUpdate(ChatRole.Assistant, chunk);
            await Task.Delay(40, cancellationToken);
        }
    }

    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose()
    {
    }
}
