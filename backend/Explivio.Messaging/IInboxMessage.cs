namespace Explivio.Messaging;

// A record that a consumer has already handled a given Service Bus message. Consuming is
// at-least-once, so the same message can arrive more than once (retries, redelivery). Recording the
// Service Bus MessageId (the originating outbox row id) lets a consumer detect and skip a duplicate
// — the inbox pattern, the consumer-side counterpart to the outbox.
//
// Each consumer owns a concrete implementation mapped to its own schema and migration history, so
// the inbox tables evolve independently; the shared InboxProcessor works against this interface.
public interface IInboxMessage
{
    // The Service Bus MessageId, which the outbox sets to the originating outbox row id.
    string MessageId { get; set; }
    string Subject { get; set; }
    DateTime ProcessedOnUtc { get; set; }
}
