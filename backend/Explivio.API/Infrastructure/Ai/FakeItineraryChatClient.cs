using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.Ai;

// F12: a deterministic stand-in for a real chat model, used when no AI provider is configured
// (AI:Endpoint / AI:ApiKey absent). It lets the app build, run, and pass tests with no credentials
// and no cost — the same gating idea as SQL/Service Bus. It returns the same small itinerary as JSON
// matching GeneratedItinerary; the structured-output helper deserializes it like a real reply.
// F29: it also serves the trip recap — a free-text use case — by returning a canned narrative when the
// prompt is a recap (the recap system prompt carries the word "recap"). Still a dev stub, not general.
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

    // F29: a canned recap narrative (free text, no JSON) for when the prompt is a recap request.
    private const string CannedRecap =
        "We set off not quite sure what to expect, and came home with a trip we'll be talking about for " +
        "a long while. The days found an easy rhythm — mornings out exploring, afternoons wandering " +
        "wherever the streets led.\n\n" +
        "A few moments stood out above the rest: the first proper look at the old town, the long lunch " +
        "that turned into an afternoon, the quiet museum hour before the crowds arrived. None of it " +
        "rushed, all of it ours.\n\n" +
        "(AI stub — set AI:Endpoint and AI:ApiKey for a recap written from your real trip.)";

    // Pick the canned response for the use case: a recap prompt (F29) gets the narrative, everything
    // else gets the itinerary JSON (F12/F13). The recap system prompt carries the word "recap".
    private static string ChooseContent(IEnumerable<ChatMessage> messages)
    {
        var mentionsRecap = messages.Any(m =>
            m.Text?.Contains("recap", StringComparison.OrdinalIgnoreCase) == true);
        return mentionsRecap ? CannedRecap : CannedItineraryJson;
    }

    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var message = new ChatMessage(ChatRole.Assistant, ChooseContent(messages));
        return Task.FromResult(new ChatResponse(message));
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Emit the canned content in small chunks with a short delay so the streaming path (F13/F29)
        // behaves like a real model — the client's progressive reveal actually animates with no provider.
        var content = ChooseContent(messages);
        const int chunkSize = 24;
        for (var i = 0; i < content.Length; i += chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var chunk = content.Substring(i, Math.Min(chunkSize, content.Length - i));
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
