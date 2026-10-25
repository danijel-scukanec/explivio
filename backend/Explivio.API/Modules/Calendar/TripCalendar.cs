using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Reservations;
using Explivio.API.Modules.Trips;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Calendar;

// F27: assembles an ItineraryDocument for a trip from its activities (F08) and reservations (F23).
// Used by both the authed per-trip export endpoint and the anonymous share-token feed, so the two
// paths produce byte-identical calendars.
public static class TripCalendar
{
    // Default duration given to a timed event that has no explicit end.
    private static readonly TimeSpan DefaultDuration = TimeSpan.FromHours(1);

    public static async Task<ItineraryDocument?> LoadAsync(AppDbContext db, Guid tripId, CancellationToken ct)
    {
        var trip = await db.Trips
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == tripId, ct);
        if (trip is null) return null;

        var activities = await db.Activities
            .Where(a => a.TripId == tripId)
            .OrderBy(a => a.Date).ThenBy(a => a.SortOrder)
            .ToListAsync(ct);

        var reservations = await db.Reservations
            .Where(r => r.TripId == tripId)
            .OrderBy(r => r.StartsAt)
            .ToListAsync(ct);

        var events = new List<CalendarEvent>(activities.Count + reservations.Count);
        events.AddRange(activities.Select(ToEvent));
        events.AddRange(reservations.Select(ToEvent));

        // All-day events sort before timed ones on the same date; timed events sort by their start.
        var ordered = events
            .OrderBy(e => e.Date)
            .ThenBy(e => e.Start ?? e.Date.ToDateTime(TimeOnly.MinValue))
            .ToList();

        return new ItineraryDocument(
            trip.Name, trip.DestinationSummary(), trip.StartDate, trip.EndDate, ordered);
    }

    private static CalendarEvent ToEvent(Activity a)
    {
        var allDay = a.StartTime is null;
        DateTime? start = null;
        DateTime? end = null;
        if (!allDay)
        {
            start = a.Date.ToDateTime(a.StartTime!.Value);
            end = a.EndTime is { } finish
                ? a.Date.ToDateTime(finish)
                : start.Value.Add(DefaultDuration);
        }

        return new CalendarEvent(
            Uid: $"activity-{a.Id:N}",
            Summary: a.Name,
            Description: a.Description,
            Location: a.Location,
            Date: a.Date,
            Start: start,
            End: end,
            AllDay: allDay,
            Latitude: a.Latitude,
            Longitude: a.Longitude,
            Kind: a.Category.ToString());
    }

    private static CalendarEvent ToEvent(Reservation r)
    {
        var end = r.EndsAt ?? r.StartsAt.Add(DefaultDuration);
        var detail = string.Join(" · ", new[]
            {
                r.Provider,
                r.ConfirmationNumber is { Length: > 0 } c ? $"Confirmation {c}" : null,
                r.Notes,
            }.Where(s => !string.IsNullOrWhiteSpace(s)));

        return new CalendarEvent(
            Uid: $"reservation-{r.Id:N}",
            Summary: r.Title,
            Description: string.IsNullOrEmpty(detail) ? null : detail,
            Location: r.Provider,
            Date: DateOnly.FromDateTime(r.StartsAt),
            Start: r.StartsAt,
            End: end,
            AllDay: false,
            Latitude: null,
            Longitude: null,
            Kind: r.Type.ToString());
    }
}
