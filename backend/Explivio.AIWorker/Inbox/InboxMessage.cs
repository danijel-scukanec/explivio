using Explivio.Messaging;

namespace Explivio.AIWorker.Inbox;

// F06: this worker's inbox row, living in the "worker" schema. The shared InboxProcessor records one
// per handled message to dedupe at-least-once delivery; see IInboxMessage for the pattern.
public sealed class InboxMessage : IInboxMessage
{
    // The Service Bus MessageId, which the outbox sets to the originating outbox row id.
    public string MessageId { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public DateTime ProcessedOnUtc { get; set; }
}
