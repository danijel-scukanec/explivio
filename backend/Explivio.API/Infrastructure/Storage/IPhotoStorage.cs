namespace Explivio.API.Infrastructure.Storage;

/// <summary>
/// F22: stores a single cover photo per trip in blob storage. Registered only when a "blobs"
/// connection string is present (Aspire supplies it locally via the Azurite emulator and from real
/// Azure Storage when deployed), so endpoints inject it as nullable and degrade to 503 when the
/// feature is not configured — mirroring how the Cosmos/Service Bus features are gated.
/// </summary>
public interface IPhotoStorage
{
    /// <summary>Uploads (or overwrites) the cover photo for a trip.</summary>
    Task UploadCoverAsync(Guid tripId, Stream content, string contentType, CancellationToken cancellationToken);

    /// <summary>
    /// Opens the cover photo for a trip, or returns null if it has none. The caller owns the stream.
    /// </summary>
    Task<CoverPhoto?> OpenCoverAsync(Guid tripId, CancellationToken cancellationToken);

    /// <summary>Removes a trip's cover photo. A no-op if it doesn't exist.</summary>
    Task DeleteCoverAsync(Guid tripId, CancellationToken cancellationToken);
}

/// <summary>A cover photo's bytes plus the content type to serve it with.</summary>
public sealed record CoverPhoto(Stream Content, string ContentType);
