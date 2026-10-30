namespace Explivio.API.Infrastructure.Storage;

/// <summary>
/// F17: stores a single scanned receipt image per expense in blob storage. Registered only when a
/// "blobs" connection string is present (Azurite locally / real Azure Storage when deployed), so
/// endpoints inject it as nullable and degrade to 503 when the feature is not configured — mirroring
/// <see cref="IPhotoStorage"/> (trip covers).
/// </summary>
public interface IReceiptStorage
{
    /// <summary>Uploads (or overwrites) the receipt image for an expense.</summary>
    Task UploadReceiptAsync(Guid expenseId, Stream content, string contentType, CancellationToken cancellationToken);

    /// <summary>Opens the receipt image for an expense, or returns null if it has none. The caller owns the stream.</summary>
    Task<ReceiptImage?> OpenReceiptAsync(Guid expenseId, CancellationToken cancellationToken);

    /// <summary>Removes an expense's receipt image. A no-op if it doesn't exist.</summary>
    Task DeleteReceiptAsync(Guid expenseId, CancellationToken cancellationToken);
}

/// <summary>A receipt image's bytes plus the content type to serve it with.</summary>
public sealed record ReceiptImage(Stream Content, string ContentType);
