namespace Explivio.AIWorker.Inbox;

// F06: a record of a domain-event message this worker has already handled. Consuming Service Bus is
// at-least-once, so the same message can arrive more than once (retries, redelivery). Recording the
// Service Bus MessageId (the outbox row id) lets us detect and skip a duplicate — the inbox pattern,
// the consumer-side counterpart to F05's outbox.
public sealed class InboxMessage
{
    // The Service Bus MessageId, which the outbox sets to the originating outbox row id.
    public required string MessageId { get; set; }
    public required string Subject { get; set; }
    public DateTime ProcessedOnUtc { get; set; }
}
