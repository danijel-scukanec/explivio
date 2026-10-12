using Explivio.Messaging;

namespace Explivio.API.Infrastructure.ReadModel;

// F08: inbox dedupe for the projector, living in the "read" schema. Unlike the log-only workers,
// projection is NOT idempotent (ActivityCount + 1, TotalSpend + amount), so a redelivered event
// would corrupt the totals. The shared InboxProcessor records each handled message and saves it in
// the same transaction as the projection change, making the projection effectively exactly-once.
public sealed class ProjectionInboxMessage : IInboxMessage
{
    public string MessageId { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public DateTime ProcessedOnUtc { get; set; }
}
