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

    // F23: explicit per-day ordering. Activities are listed by Date then SortOrder, so drag-to-reorder
    // simply rewrites these values — start time is informational and no longer the sort key.
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public static Activity Create(
        Guid tripId, string name, string? description, string? location, DateOnly date,
        TimeOnly? startTime, TimeOnly? endTime, ActivityCategory category, double? latitude, double? longitude,
        int sortOrder)
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
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
        };

        activity.AddDomainEvent(new ActivityAddedDomainEvent(tripId, activity.Id));
        return activity;
    }

    // F23: in-place edit of a planned activity. No domain event is raised — none of these fields feed
    // the read model (which only counts activities), so a collaboration nudge from the handler is
    // enough to refresh viewers.
    public void Update(
        string name, string? description, string? location, DateOnly date,
        TimeOnly? startTime, TimeOnly? endTime, ActivityCategory category, double? latitude, double? longitude,
        int sortOrder)
    {
        Name = name;
        Description = description;
        Location = location;
        Date = date;
        StartTime = startTime;
        EndTime = endTime;
        Category = category;
        Latitude = latitude;
        Longitude = longitude;
        SortOrder = sortOrder;
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
