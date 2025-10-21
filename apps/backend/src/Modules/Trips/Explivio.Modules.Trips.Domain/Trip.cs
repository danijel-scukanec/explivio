namespace Explivio.Modules.Trips.Domain;

public sealed class Trip
{
    private readonly List<Participant> _participants = [];
    private readonly List<DestinationId> _destinationIds = [];
    
    public TripId Id { get; }
    
    public string Title { get; }

    public string? Description { get; }

    public DateTime StartDate { get; }

    public DateTime EndDate { get; }
    
    public DateTime CreatedAtUtc { get; }
    
    public IReadOnlyCollection<Participant> Participants => _participants.AsReadOnly();
    
    public IReadOnlyCollection<DestinationId> DestinationIds => _destinationIds.AsReadOnly();

    private Trip() { }

    private Trip(TripId id, string title, string? description, DateTime startDate, DateTime endDate, DateTime createdAtUtc)
    {
        ArgumentNullException.ThrowIfNull(id);
        
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Trip title is required.", nameof(title));
        }

        if (endDate < startDate)
        {
            throw new ArgumentException("End date cannot be before start date.", nameof(endDate));
        }

        Id = id;
        Title = title;
        Description = description;
        StartDate = startDate;
        EndDate = endDate;
        CreatedAtUtc = createdAtUtc;
    }
    
    public static Trip Create(string title, string? description, DateTime startDate, DateTime endDate)
    {
        var trip = new Trip(TripId.New(), title.Trim(), description?.Trim(), startDate, endDate, DateTime.UtcNow);
        return trip;
    }
    
    public void AddParticipant(Email email, string? displayName = null)
    {
        var exists = _participants.Any(p => p.Email.Value.Equals(email.Value, StringComparison.OrdinalIgnoreCase));

        if (exists)
        {
            throw new InvalidOperationException($"Participant with email {email} already added.");
        }

        var participant = new Participant(ParticipantId.New(), email, displayName, DateTime.UtcNow);
        _participants.Add(participant);
    }
    
    public void AddDestination(DestinationId destinationId)
    {
        if (_destinationIds.Contains(destinationId))
        {
            throw new InvalidOperationException($"Destination {destinationId} already added.");
        }
        
        _destinationIds.Add(destinationId);
    }
}

public sealed record TripId(Guid Value)
{
    public static TripId New() => new(Guid.NewGuid());
    
    public override string ToString() => Value.ToString();
}