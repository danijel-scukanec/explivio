namespace Explivio.API.Modules.Documents;

// F24: the read shape for a trip document's metadata. The bytes are fetched separately from the
// content endpoint; this is what the list returns and what the client renders.
public record DocumentResponse(
    Guid Id,
    Guid TripId,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTime UploadedAt);
