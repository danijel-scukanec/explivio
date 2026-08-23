namespace Explivio.API.Infrastructure.Domain;

// F05: base for aggregate roots. Collects domain events raised during a business operation;
// the SaveChanges interceptor drains them into the outbox in the same transaction.
public abstract class Entity
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}
