using MediatR;

namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

// F12: a request to generate a draft itinerary for a trip from a free-text prompt. Returns the
// draft (not persisted) — the synchronous read/write flow the user waits on, and the base F13 will
// stream over SignalR.
public record GenerateItineraryCommand(
    Guid TripId,
    string Prompt,
    int Days,
    string? Style,
    string? Budget
) : IRequest<GeneratedItinerary>;
