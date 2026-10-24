using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Itinerary;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.CloneTrip;

// F26: copies a trip's route (stops) and itinerary (activities) into a brand-new trip owned by the
// caller. Deliberately does NOT copy expenses, reservations, documents, checklists, members or likes
// — a clone is a planning template, not a full duplicate. The new trip and its activities raise their
// normal creation events, so they enter the read models exactly like any hand-made trip.
public class CloneTripHandler(AppDbContext db) : IRequestHandler<CloneTripCommand, Guid?>
{
    public async Task<Guid?> Handle(CloneTripCommand command, CancellationToken cancellationToken)
    {
        var source = await db.Trips
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == command.SourceTripId, cancellationToken);
        if (source is null)
        {
            return null;
        }

        // Only clone trips the caller may see: public ones, or ones they're a member of.
        if (!source.IsPublic)
        {
            var isMember = await db.TripMembers
                .AnyAsync(m => m.TripId == source.Id && m.UserId == command.UserId, cancellationToken);
            if (!isMember)
            {
                return null;
            }
        }

        var stops = source.Stops
            .OrderBy(s => s.Order)
            .Select(s => new TripStopInput(s.Place, s.ArriveDate, s.DepartDate, s.Latitude, s.Longitude))
            .ToList();

        var clone = Trip.Create(
            $"{source.Name} (copy)",
            source.StartDate,
            source.EndDate,
            source.TravelerCount,
            command.UserId,
            stops,
            source.BaseCurrency);
        db.Trips.Add(clone);
        db.TripMembers.Add(TripMember.Create(clone.Id, command.UserId, TripRole.Owner));

        // Copy the itinerary. Load the source activities and recreate each on the clone, preserving
        // day, time, category, location and order.
        var activities = await db.Activities
            .Where(a => a.TripId == source.Id)
            .OrderBy(a => a.Date).ThenBy(a => a.SortOrder)
            .ToListAsync(cancellationToken);
        foreach (var a in activities)
        {
            db.Activities.Add(Activity.Create(
                clone.Id, a.Name, a.Description, a.Location, a.Date,
                a.StartTime, a.EndTime, a.Category, a.Latitude, a.Longitude, a.SortOrder));
        }

        await db.SaveChangesAsync(cancellationToken);
        return clone.Id;
    }
}
