namespace Explivio.Modules.Trips.Domain;

public sealed class Participant
{
    public ParticipantId Id { get; }
    
    public Email Email { get; }
    
    public string? DisplayName { get; }
    
    public DateTime AddedAtUtc { get; }

    private Participant() { }

    internal Participant(
        ParticipantId id,
        Email email,
        string? displayName,
        DateTime addedAtUtc)
    {
        ArgumentNullException.ThrowIfNull(id);
        ArgumentNullException.ThrowIfNull(email);
        
        Id = id;
        Email = email;
        DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        AddedAtUtc = addedAtUtc;
    }
}

public sealed record ParticipantId(Guid Value)
{
    public static ParticipantId New() => new(Guid.NewGuid());
    
    public override string ToString() => Value.ToString();
}