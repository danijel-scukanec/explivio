using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

public class Trip : Entity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int TravelerCount { get; set; }
    public TripStatus Status { get; set; }
    public bool HasCoverPhoto { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Factory for a new trip: the aggregate raises its own creation event (F05).
    public static Trip Create(
        string name, string destination, DateOnly startDate, DateOnly endDate, int travelerCount, Guid userId)
    {
        var trip = new Trip
        {
            Id = Guid.NewGuid(),
            Name = name,
            Destination = destination,
            StartDate = startDate,
            EndDate = endDate,
            TravelerCount = travelerCount,
            Status = TripStatus.Planned,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        trip.AddDomainEvent(new TripCreatedDomainEvent(
            trip.Id, trip.Name, trip.Destination, trip.StartDate, trip.EndDate, trip.TravelerCount, trip.UserId));
        return trip;
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
