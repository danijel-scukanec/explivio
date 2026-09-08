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
        // Single-chunk streaming so a streaming caller (F13) still works against the stub.
        yield return new ChatResponseUpdate(ChatRole.Assistant, CannedItineraryJson);
        await Task.CompletedTask;
    }

    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose()
    {
    }
}
