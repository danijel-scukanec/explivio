namespace Explivio.Modules.Trips.Domain;

public sealed class Destination
{
    public DestinationId Id { get; private set; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    
    private Destination() { } 

    private Destination(DestinationId id, string name, string? description)
    {
        Id = id;
        Name = name;
        Description = description;
    }
    
    public static Destination Create(string name, string? description = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Destination name is required.", nameof(name));
        }

        return new Destination(DestinationId.New(), name.Trim(), description?.Trim());
    }
}

public record DestinationId(Guid Value)
{
    public static DestinationId New() => new(Guid.NewGuid());
    
    public override string ToString() => Value.ToString();
}