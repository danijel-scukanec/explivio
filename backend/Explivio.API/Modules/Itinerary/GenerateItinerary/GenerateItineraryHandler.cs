using System.Text;
using MediatR;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

// F12: calls the language model to produce a draft itinerary. Depends only on IChatClient
// (Microsoft.Extensions.AI) — the provider (Azure OpenAI, GitHub Models, or the dev fake) is chosen
// in DI, so this handler never knows which is behind it. Uses structured output: the desired
// GeneratedItinerary shape is sent as a JSON schema and the model must reply in exactly that form,
// so there is no brittle free-text parsing.
public sealed class GenerateItineraryHandler(IChatClient chatClient)
    : IRequestHandler<GenerateItineraryCommand, GeneratedItinerary>
{
    private const string SystemPrompt =
        "You are an expert travel planner. Produce a realistic, well-paced day-by-day itinerary. " +
        "Spread activities sensibly across the requested number of days, group nearby things together, " +
        "and choose the most fitting category for each activity. Keep descriptions concise and practical.";

    public async Task<GeneratedItinerary> Handle(GenerateItineraryCommand command, CancellationToken cancellationToken)
    {
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, SystemPrompt),
            new(ChatRole.User, BuildUserPrompt(command)),
        };

        // GetResponseAsync<T> attaches the JSON schema for GeneratedItinerary and deserializes the
        // model's reply into it — the structured-output path.
        var response = await chatClient.GetResponseAsync<GeneratedItinerary>(
            messages, cancellationToken: cancellationToken);

        return response.Result;
    }

    private static string BuildUserPrompt(GenerateItineraryCommand command)
    {
        var sb = new StringBuilder();
        sb.Append($"Plan a {command.Days}-day itinerary. ");
        sb.Append($"Traveler request: {command.Prompt}.");

        if (!string.IsNullOrWhiteSpace(command.Style))
        {
            sb.Append($" Preferred style: {command.Style}.");
        }

        if (!string.IsNullOrWhiteSpace(command.Budget))
        {
            sb.Append($" Budget: {command.Budget}.");
        }

        sb.Append($" Use day numbers 1 through {command.Days}.");
        return sb.ToString();
    }
}
