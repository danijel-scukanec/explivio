using MediatR;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

// F12: calls the language model to produce a draft itinerary. Depends only on IChatClient
// (Microsoft.Extensions.AI) — the provider (Azure OpenAI, GitHub Models, or the dev fake) is chosen
// in DI, so this handler never knows which is behind it. Uses structured output: the desired
// GeneratedItinerary shape is sent as a JSON schema and the model must reply in exactly that form,
// so there is no brittle free-text parsing. The streaming equivalent lives in ItineraryGenerationHub
// (F13); both share the prompt/contract via ItineraryChat.
public sealed class GenerateItineraryHandler(IChatClient chatClient)
    : IRequestHandler<GenerateItineraryCommand, GeneratedItinerary>
{
    public async Task<GeneratedItinerary> Handle(GenerateItineraryCommand command, CancellationToken cancellationToken)
    {
        var response = await chatClient.GetResponseAsync<GeneratedItinerary>(
            ItineraryChat.BuildMessages(command), cancellationToken: cancellationToken);

        return response.Result;
    }
}
