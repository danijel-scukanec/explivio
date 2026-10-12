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
        var destination = await db.Trips
            .Where(t => t.Id == command.TripId)
            .Select(t => t.Destination)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(destination))
        {
            return string.Empty;
        }

        var matches = await retriever.RetrieveAsync(destination, command.Prompt, TopK, cancellationToken);
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
