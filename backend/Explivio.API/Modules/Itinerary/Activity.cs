using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Itinerary;

// F08: an aggregate so it can raise domain events (added/removed) that feed the read-model
// projector. The factory and Remove() are the only places those events are raised.
public class Activity : Entity
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Location { get; set; }
    public DateOnly Date { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public ActivityCategory Category { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime CreatedAt { get; set; }

    public static Activity Create(
        Guid tripId, string name, string? description, string? location, DateOnly date,
        TimeOnly? startTime, TimeOnly? endTime, ActivityCategory category, double? latitude, double? longitude)
    {
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            Name = name,
            Description = description,
            Location = location,
            Date = date,
            StartTime = startTime,
            EndTime = endTime,
            Category = category,
            Latitude = latitude,
            Longitude = longitude,
            CreatedAt = DateTime.UtcNow,
        };

        activity.AddDomainEvent(new ActivityAddedDomainEvent(tripId, activity.Id));
        return activity;
    }

    // Raise the removal event before the aggregate is removed so the outbox interceptor captures it.
    public void Remove()
    {
        AddDomainEvent(new ActivityRemovedDomainEvent(TripId, Id));
    }
}

public enum ActivityCategory
{
    Sightseeing,
    Food,
    Transport,
    Accommodation,
    Adventure,
    Other
}
