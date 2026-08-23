namespace Explivio.API.Infrastructure.Domain;

// F05: marker for something that happened in the domain and is worth announcing to other
// services (e.g. a trip was created). Raised by aggregates, captured into the outbox on save.
public interface IDomainEvent;
