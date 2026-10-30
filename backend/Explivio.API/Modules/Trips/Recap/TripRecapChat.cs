using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Trips.Recap;

// F29: the prompt for the trip recap. A plain free-text narrative (not structured output like F12) —
// the hub streams the model's tokens straight to the client. The system prompt carries the word
// "recap" so the offline FakeItineraryChatClient can tell a recap request from an itinerary one and
// return a sensible canned narrative instead of itinerary JSON.
public static class TripRecapChat
{
    private const string SystemPrompt =
        "You write a warm, vivid trip recap — a short keepsake looking back on a journey that has " +
        "happened. Use the first person plural (\"we\"). Three or four short paragraphs: open with the " +
        "route and feel of the trip, call out a few standout moments from the itinerary by name, and " +
        "close on a reflective note. Ground every detail in the facts provided; do not invent places " +
        "or events. Write flowing prose only — no headings, lists, or markdown.";

    public static List<ChatMessage> BuildMessages(string context)
    {
        return
        [
            new ChatMessage(ChatRole.System, SystemPrompt),
            new ChatMessage(ChatRole.User, $"Write the recap for this trip.\n\n{context}"),
        ];
    }
}
