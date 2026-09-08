namespace Explivio.API.Infrastructure.Idempotency;

// F04 (boundary idempotency, HTTP half): a record of a mutating request that carried an
// Idempotency-Key. The first request reserves the (UserId, Key) pair, runs, and stores its response;
// a retry with the same key replays the stored response instead of running the operation again — so a
// client that retries after a dropped connection never creates a duplicate. Scoped by user so keys
// from different callers can't collide. The consumer-side half of F04 is the message-id inbox dedupe.
public sealed class IdempotencyRecord
{
    public Guid UserId { get; set; }
    public string Key { get; set; } = string.Empty;

    // Captured response, filled in once the first request completes. Null while the request is still
    // in flight (the reservation), which is how concurrent duplicates are detected.
    public int? StatusCode { get; set; }
    public string? ContentType { get; set; }
    public byte[]? Body { get; set; }

    public DateTime CreatedOnUtc { get; set; }
    public DateTime? CompletedOnUtc { get; set; }
}
