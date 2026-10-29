using System.Globalization;
using System.Text;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Rag;
using Explivio.API.Modules.Budget.GetBudgetSummary;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Itinerary.Assistant;

// F16: assembles a grounding block describing THIS trip for the assistant — the trip facts, its
// current activities (with ids so the edit tools can target them), a budget summary, and a set of
// relevant real places from the F14 RAG corpus. Everything the model is allowed to reason from lives
// here, so it answers about the actual trip rather than guessing.
public interface ITripAssistantContext
{
    Task<string> BuildAsync(Guid tripId, string? focus, CancellationToken cancellationToken);
}

public sealed class TripAssistantContext(
    AppDbContext db,
    IMediator mediator,
    IPlaceRetriever retriever,
    ILogger<TripAssistantContext> logger) : ITripAssistantContext
{
    private const int TopK = 6;

    public async Task<string> BuildAsync(Guid tripId, string? focus, CancellationToken cancellationToken)
    {
        var trip = await db.Trips.Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == tripId, cancellationToken);
        if (trip is null) return "The trip could not be loaded.";

        var activities = await db.Activities
            .Where(a => a.TripId == tripId)
            .OrderBy(a => a.Date).ThenBy(a => a.SortOrder)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("You are assisting with THIS specific trip. Current trip data:");
        sb.AppendLine($"- Name: {trip.Name}");
        sb.AppendLine($"- Route: {trip.DestinationSummary()}");
        var days = (trip.EndDate.DayNumber - trip.StartDate.DayNumber) + 1;
        sb.AppendLine($"- Dates: {trip.StartDate:yyyy-MM-dd} to {trip.EndDate:yyyy-MM-dd} ({days} days), " +
                      $"{trip.TravelerCount} traveler(s)");
        sb.AppendLine($"- Status: {trip.Status}");

        var budget = await mediator.Send(new GetBudgetSummaryQuery(tripId), cancellationToken);
        if (budget.Expenses.Count > 0)
        {
            var total = budget.ConversionAvailable
                ? $"{budget.Total.ToString("0.##", CultureInfo.InvariantCulture)} {budget.BaseCurrency}"
                : "(mixed currencies; live FX unavailable)";
            sb.AppendLine($"- Budget: {budget.Expenses.Count} expense(s), total {total}");
        }
        else
        {
            sb.AppendLine("- Budget: no expenses yet");
        }

        if (activities.Count == 0)
        {
            sb.AppendLine("- Activities: none planned yet");
        }
        else
        {
            sb.AppendLine("- Activities (id | day | time | name | category):");
            foreach (var a in activities)
            {
                var day = (a.Date.DayNumber - trip.StartDate.DayNumber) + 1;
                var time = a.StartTime?.ToString("HH\\:mm", CultureInfo.InvariantCulture) ?? "—";
                sb.AppendLine($"  {a.Id} | day {day} | {time} | {a.Name} | {a.Category}");
            }
        }

        var destination = trip.DestinationSummary();
        if (!string.IsNullOrWhiteSpace(destination))
        {
            try
            {
                var matches = await retriever.RetrieveAsync(destination, focus ?? destination, TopK, cancellationToken);
                if (matches.Count > 0)
                {
                    sb.AppendLine("Relevant real places you may suggest (prefer these, use exact names):");
                    foreach (var m in matches)
                        sb.AppendLine($"  - {m.Name} ({m.Category}): {m.Text}");
                }
            }
            catch (Exception ex)
            {
                // RAG only ever adds context; never let it break the chat.
                logger.LogInformation(ex, "Place retrieval failed for assistant context; continuing ungrounded.");
            }
        }

        return sb.ToString();
    }
}
