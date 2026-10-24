namespace Explivio.API.Modules.Documents;

// F24: metadata for a file attached to a trip. The bytes live in blob storage (BlobDocumentStorage);
// this row is the catalogue, so the list endpoint never has to enumerate the container. One row per
// uploaded file; delete removes both the row and its blob.
public class TripDocument
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; }

    public static TripDocument Create(Guid tripId, string fileName, string contentType, long sizeBytes)
    {
        return new TripDocument
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            FileName = fileName,
            ContentType = contentType,
            SizeBytes = sizeBytes,
            UploadedAt = DateTime.UtcNow,
        };
    }
}
