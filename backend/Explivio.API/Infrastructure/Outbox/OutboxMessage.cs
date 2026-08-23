namespace Explivio.API.Infrastructure.Outbox;

// F05: a domain event captured for reliable publishing. Written in the same transaction as the
// business change; the processor publishes it to Service Bus and stamps ProcessedOnUtc.
public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public required string Type { get; set; }
    public required string Content { get; set; }
    public DateTime OccurredOnUtc { get; set; }
    public DateTime? ProcessedOnUtc { get; set; }
    public string? Error { get; set; }
}
