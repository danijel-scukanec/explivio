namespace Explivio.API.Infrastructure.ReadModel;

// F08: inbox dedupe for the projector. Unlike the log-only workers, projection is NOT idempotent
// (ActivityCount + 1, TotalSpend + amount), so a redelivered event would corrupt the totals.
// Recording each handled Service Bus MessageId (the outbox row id) and updating the read model in
// the same transaction makes the projection effectively exactly-once.
public sealed class ProjectionInboxMessage
{
    public required string MessageId { get; set; }
    public required string Subject { get; set; }
    public DateTime ProcessedOnUtc { get; set; }
}
