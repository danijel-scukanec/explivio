using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

public class Trip : Entity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int TravelerCount { get; set; }
    public TripStatus Status { get; set; }
    public bool HasCoverPhoto { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // F22: the trip's ordered stops are the source of truth for where it goes (multi-destination).
    // The old single "Destination" string is gone — DestinationSummary() derives a display string
    // from these when one is needed (read model, events, API responses).
    public List<TripStop> Stops { get; } = [];

    // Factory for a new trip: the aggregate raises its own creation event (F05). A trip is created
    // with at least one stop (validated before here).
    public static Trip Create(
        string name, DateOnly startDate, DateOnly endDate, int travelerCount, Guid userId,
        IReadOnlyList<TripStopInput> stops)
    {
        var trip = new Trip
        {
            Id = Guid.NewGuid(),
            Name = name,
            StartDate = startDate,
            EndDate = endDate,
            TravelerCount = travelerCount,
            Status = TripStatus.Planned,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        trip.ReplaceStops(stops);

        // F08: the event carries a derived destination summary so the read-model projector (and the
        // notification/AI workers) keep working unchanged — they only ever read a destination string.
        trip.AddDomainEvent(new TripCreatedDomainEvent(
            trip.Id, trip.Name, trip.DestinationSummary(), trip.StartDate, trip.EndDate,
            trip.TravelerCount, trip.UserId));
        return trip;
    }

    // F22: replace the whole ordered route (add/remove/reorder/edit in one go). Raises an event so the
    // read model's denormalized destination summary is kept current.
    public void SetStops(IReadOnlyList<TripStopInput> stops)
    {
        ReplaceStops(stops);
        AddDomainEvent(new TripStopsChangedDomainEvent(Id, DestinationSummary()));
    }

    // F22: a human-readable summary of the route, e.g. "Lisbon → Porto → Madrid". Used wherever a
    // single destination string is still wanted (API display, read model, events).
    public string DestinationSummary() =>
        string.Join(" → ", Stops.OrderBy(s => s.Order).Select(s => s.Place));

    private void ReplaceStops(IReadOnlyList<TripStopInput> stops)
    {
        // Note: don't assign Id — it's a store-generated key, so EF supplies a GUID on insert. Setting
        // it manually makes EF treat a new child of an already-tracked trip as an UPDATE (an existing
        // row) rather than an INSERT, which fails when replacing stops. TripId is set by relationship
        // fixup when the stop is added to this trip's collection.
        Stops.Clear();
        for (var i = 0; i < stops.Count; i++)
        {
            var input = stops[i];
            Stops.Add(new TripStop
            {
                Order = i,
                Place = input.Place,
                ArriveDate = input.ArriveDate,
                DepartDate = input.DepartDate,
                Latitude = input.Latitude,
                Longitude = input.Longitude,
            });
        }

        UpdatedAt = DateTime.UtcNow;
    }

    // F22: change the trip's lifecycle status (Draft → Planned → Active → Completed, or Cancelled).
    public void SetStatus(TripStatus status)
    {
        Status = status;
        UpdatedAt = DateTime.UtcNow;
    }

    // F22: the trip's cover photo is stored in blob storage keyed by the trip id; the entity only
    // records whether one exists so reads can tell clients without touching storage.
    public void SetCoverPhoto()
    {
        HasCoverPhoto = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearCoverPhoto()
    {
        HasCoverPhoto = false;
        UpdatedAt = DateTime.UtcNow;
    }

    // F08: raise the deletion event before the aggregate is removed, so the outbox interceptor
    // captures it in the same transaction and the read-model projector can drop the summary.
    public void Delete()
    {
        AddDomainEvent(new TripDeletedDomainEvent(Id));
    }
}
