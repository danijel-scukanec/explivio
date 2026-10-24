namespace Explivio.API.Infrastructure.Storage;

/// <summary>
/// F24: stores arbitrary trip documents (PDFs, images, tickets…) in blob storage — one blob per
/// document, keyed by trip and document id. Registered only when a "blobs" connection string is
/// present (Azurite locally, real Azure Storage when deployed), so endpoints inject it as nullable
/// and degrade to 503/404 when the feature is not configured — the same posture as the F22 cover
/// photos (<see cref="IPhotoStorage"/>). File metadata lives in SQL (TripDocument); this only moves
/// bytes.
/// </summary>
public interface IDocumentStorage
{
    /// <summary>Uploads the bytes for a trip document.</summary>
    Task UploadAsync(Guid tripId, Guid documentId, Stream content, string contentType, CancellationToken cancellationToken);

    /// <summary>Opens a trip document's bytes, or returns null if the blob is missing.</summary>
    Task<StoredDocument?> OpenAsync(Guid tripId, Guid documentId, CancellationToken cancellationToken);

    /// <summary>Removes a trip document's bytes. A no-op if it doesn't exist.</summary>
    Task DeleteAsync(Guid tripId, Guid documentId, CancellationToken cancellationToken);
}

/// <summary>A stored document's bytes plus the content type to serve it with.</summary>
public sealed record StoredDocument(Stream Content, string ContentType);
