using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.Assistant;

// F16: builds the message list for a chat turn — the assistant persona + capabilities, the trip
// context block, then the client-sent conversation history. Kept separate from the hub so the prompt
// is in one place (mirrors how ItineraryChat holds the generation prompt).
public static class TripAssistantChat
{
    private const string Persona =
        "You are Explivio's travel assistant for a single trip. Answer using ONLY the trip data " +
        "provided below; if something isn't in the data, say so rather than inventing it. Be concise " +
        "and practical. Day numbers are 1-based (day 1 = the trip's start date).";

    private const string EditCapabilities =
        " You can modify the trip by calling the provided tools (add/update/delete activities, add an " +
        "expense, change the trip status). Confirm with the user before a destructive change such as " +
        "deleting something. After a change, briefly state exactly what you did.";

    private const string ReadOnlyCapabilities =
        " You have read-only access: answer and suggest, but you cannot change the trip (the user is a " +
        "viewer). If asked to make a change, explain that it needs Editor access.";

    public static List<ChatMessage> BuildMessages(string context, IReadOnlyList<ChatTurn> history, bool canEdit)
    {
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, Persona + (canEdit ? EditCapabilities : ReadOnlyCapabilities)),
            new(ChatRole.System, context),
        };

        foreach (var turn in history ?? [])
        {
            if (string.IsNullOrWhiteSpace(turn.Content)) continue;
            var role = string.Equals(turn.Role, "assistant", StringComparison.OrdinalIgnoreCase)
                ? ChatRole.Assistant
                : ChatRole.User;
            messages.Add(new ChatMessage(role, turn.Content));
        }

        return messages;
    }
}
