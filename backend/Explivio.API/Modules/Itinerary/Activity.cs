namespace Explivio.API.Modules.Itinerary;

public class Activity
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
    public DateTime CreatedAt { get; set; }
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
