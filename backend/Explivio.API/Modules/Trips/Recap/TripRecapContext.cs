using System.Globalization;
using System.Text;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Budget.GetBudgetSummary;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.Recap;

// F29: assembles the factual material the recap is written from — the trip's route, dates, the
// day-by-day activities that actually happened, and the budget total. The model turns this into prose;
// it only reasons from what's here, so the recap reflects the real trip rather than invention.
public interface ITripRecapContext
{
    // Returns the formatted context, or null when the trip can't be loaded / has nothing to recap.
    Task<string?> BuildAsync(Guid tripId, CancellationToken cancellationToken);
}

public sealed class TripRecapContext(AppDbContext db, IMediator mediator) : ITripRecapContext
{
    public async Task<string?> BuildAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var trip = await db.Trips.Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == tripId, cancellationToken);
        if (trip is null) return null;

        var activities = await db.Activities
            .Where(a => a.TripId == tripId)
            .OrderBy(a => a.Date).ThenBy(a => a.SortOrder)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Trip facts:");
        sb.AppendLine($"- Name: {trip.Name}");
        sb.AppendLine($"- Route: {trip.DestinationSummary()}");
        var days = (trip.EndDate.DayNumber - trip.StartDate.DayNumber) + 1;
        sb.AppendLine($"- Dates: {trip.StartDate:yyyy-MM-dd} to {trip.EndDate:yyyy-MM-dd} ({days} days), " +
                      $"{trip.TravelerCount} traveler(s)");

        var budget = await mediator.Send(new GetBudgetSummaryQuery(tripId), cancellationToken);
        if (budget.Expenses.Count > 0 && budget.ConversionAvailable)
        {
            var total = budget.Total.ToString("0.##", CultureInfo.InvariantCulture);
            sb.AppendLine($"- Budget: {budget.Expenses.Count} expense(s), total about {total} {budget.BaseCurrency}");
        }
        else if (budget.Expenses.Count > 0)
        {
            sb.AppendLine($"- Budget: {budget.Expenses.Count} expense(s) across several currencies");
        }

        if (activities.Count == 0)
        {
            sb.AppendLine("- Activities: none were recorded");
        }
        else
        {
            sb.AppendLine("- Activities by day:");
            foreach (var group in activities.GroupBy(a => a.Date).OrderBy(g => g.Key))
            {
                var day = (group.Key.DayNumber - trip.StartDate.DayNumber) + 1;
                var names = string.Join(", ", group.Select(a => a.Name));
                sb.AppendLine($"  Day {day} ({group.Key:yyyy-MM-dd}): {names}");
            }
        }

        return sb.ToString();
    }
}
