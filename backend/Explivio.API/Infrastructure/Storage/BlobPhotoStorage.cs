using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Explivio.API.Infrastructure.Storage;

/// <summary>
/// F22: cover-photo storage backed by Azure Blob Storage (Azurite locally). One private container
/// holds every cover; each trip has at most one, named by its id, so a re-upload simply overwrites.
/// The content type travels with the blob, so it doesn't need to be persisted on the trip entity.
/// </summary>
public sealed class BlobPhotoStorage(BlobServiceClient blobServiceClient) : IPhotoStorage
{
    private const string ContainerName = "trip-covers";

    public async Task UploadCoverAsync(Guid tripId, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(tripId, createContainer: true, cancellationToken);
        await blob.UploadAsync(
            content,
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } },
            cancellationToken);
    }

    public async Task<CoverPhoto?> OpenCoverAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(tripId, createContainer: false, cancellationToken);
        try
        {
            var response = await blob.DownloadStreamingAsync(cancellationToken: cancellationToken);
            var contentType = response.Value.Details.ContentType ?? "application/octet-stream";
            return new CoverPhoto(response.Value.Content, contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == StatusCodes.Status404NotFound)
        {
            return null;
        }
    }

    public async Task DeleteCoverAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(tripId, createContainer: false, cancellationToken);
        await blob.DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    private async Task<BlobClient> GetBlobAsync(Guid tripId, bool createContainer, CancellationToken cancellationToken)
    {
        var container = blobServiceClient.GetBlobContainerClient(ContainerName);
        if (createContainer)
            await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        return container.GetBlobClient(tripId.ToString());
    }
}
