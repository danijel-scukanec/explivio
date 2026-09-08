using System.Runtime.CompilerServices;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

// F13: streams itinerary generation to the client token-by-token over SignalR. This is a hub
// streaming method — the client invokes it and receives an IAsyncEnumerable of text chunks, the
// idiomatic SignalR server-to-client streaming pattern. Chunks are the model's raw structured-JSON
// deltas; the client parses them progressively to reveal activity cards as each one completes.
// The non-streaming REST endpoint (F12) remains as a fallback; both share ItineraryChat.
[Authorize]
public sealed class ItineraryGenerationHub(
    IChatClient chatClient,
    IValidator<GenerateItineraryCommand> validator) : Hub
{
    public async IAsyncEnumerable<string> Generate(
        GenerateItineraryCommand command,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        // The hub bypasses the MediatR pipeline, so validate here to keep the same input contract as
        // the REST endpoint. A HubException surfaces the message to the client.
        var validation = await validator.ValidateAsync(command, cancellationToken);
        if (!validation.IsValid)
        {
            throw new HubException(string.Join(" ", validation.Errors.Select(e => e.ErrorMessage)));
        }

        var messages = ItineraryChat.BuildMessages(command);
        var options = ItineraryChat.StructuredOutputOptions();

        await foreach (var update in chatClient.GetStreamingResponseAsync(messages, options, cancellationToken))
        {
            if (!string.IsNullOrEmpty(update.Text))
            {
                yield return update.Text;
            }
        }
    }
}
