using System.Text;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Itinerary.GenerateItinerary;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.Rag;

// F14: turns an itinerary request into a grounding block of real places for the model. It resolves
// the trip's destination from the write model (the request carries only a TripId), retrieves the
// most relevant seeded places for that destination, and formats them for the prompt. Returns an
// empty string when there's no destination or no match, so generation degrades gracefully to
// ungrounded — the RAG layer only ever adds context, it never blocks a generation.
public interface IItineraryGroundingProvider
{
    Task<string> BuildAsync(GenerateItineraryCommand command, CancellationToken cancellationToken);
}

public sealed class ItineraryGroundingProvider(
    AppDbContext db,
    IPlaceRetriever retriever,
    ILogger<ItineraryGroundingProvider> logger) : IItineraryGroundingProvider
{
    private const int TopK = 6;

    public async Task<string> BuildAsync(GenerateItineraryCommand command, CancellationToken cancellationToken)
    {
        // F22: a trip's destination is now its ordered stops; derive the summary the retriever filters
        // on (e.g. "Lisbon → Porto", which matches seeded places in either city).
        var trip = await db.Trips
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == command.TripId, cancellationToken);

        var destination = trip?.DestinationSummary();
        if (string.IsNullOrWhiteSpace(destination))
        {
            return string.Empty;
        }

        IReadOnlyList<PlaceMatch> matches;
        try
        {
            matches = await retriever.RetrieveAsync(destination, command.Prompt, TopK, cancellationToken);
        }
        catch (Exception ex)
        {
            // RAG only ever adds context; a retrieval/embedding failure must never block generation.
            logger.LogWarning(ex, "Place retrieval failed for '{Destination}'; generating ungrounded.", destination);
            return string.Empty;
        }

        if (matches.Count == 0)
        {
            logger.LogInformation("No grounding places found for destination '{Destination}'.", destination);
            return string.Empty;
        }

        var sb = new StringBuilder();
        sb.AppendLine(
            $"Here are real, well-known places in {destination} to prioritise when planning. Prefer these, " +
            "using their exact names; you may add other well-known spots only if needed to fill the days:");
        foreach (var match in matches)
        {
            sb.AppendLine($"- {match.Name} ({match.Category}): {match.Text}");
        }

        return sb.ToString();
    }
}
