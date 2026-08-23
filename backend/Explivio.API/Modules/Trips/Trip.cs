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
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        trip.AddDomainEvent(new TripCreatedDomainEvent(trip.Id, trip.Destination, trip.UserId));
        return trip;
    }
}
