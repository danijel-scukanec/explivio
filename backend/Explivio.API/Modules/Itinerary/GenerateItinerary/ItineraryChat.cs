using System.Text;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

// F12/F13: the shared chat setup for itinerary generation, so the non-streaming handler (F12) and
// the streaming hub (F13) build the exact same prompt and structured-output contract. Keeping it in
// one place means both paths ask the model for the same thing in the same way.
public static class ItineraryChat
{
    private const string SystemPrompt =
        "You are an expert travel planner. Produce a realistic, well-paced day-by-day itinerary. " +
        "Spread activities sensibly across the requested number of days, group nearby things together, " +
        "and choose the most fitting category for each activity. Keep descriptions concise and practical.";

    public static IList<ChatMessage> BuildMessages(GenerateItineraryCommand command) =>
    [
        new(ChatRole.System, SystemPrompt),
        new(ChatRole.User, BuildUserPrompt(command)),
    ];

    // The structured-output contract: the model must reply as JSON matching GeneratedItinerary.
    // Used on the streaming path, where we assemble the JSON from deltas ourselves (the non-streaming
    // path gets the same schema implicitly via GetResponseAsync<GeneratedItinerary>).
    public static ChatOptions StructuredOutputOptions() => new()
    {
        ResponseFormat = ChatResponseFormat.ForJsonSchema(
            AIJsonUtilities.CreateJsonSchema(typeof(GeneratedItinerary)),
            schemaName: nameof(GeneratedItinerary),
            schemaDescription: "A day-by-day travel itinerary draft."),
    };

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
