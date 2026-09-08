namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

// F12: the AI-generated itinerary draft. This is the structured output the model must return — the
// shape is handed to Azure OpenAI as a JSON schema, so the model replies with data in exactly this
// form rather than free text. Returned to the client as a draft to review; nothing is persisted
// until the user accepts it (activities are still created via the existing CreateActivity slice).
public sealed record GeneratedItinerary(
    string Summary,
    IReadOnlyList<GeneratedActivity> Activities);

public sealed record GeneratedActivity(
    int Day,
    string Name,
    string Description,
    ActivityCategory Category,
    // Suggested local start time as "HH:mm" (e.g. "09:00"); null when the model leaves it open.
    // Kept as a string rather than TimeOnly so the model's JSON output stays simple and robust.
    string? SuggestedStartTime);
