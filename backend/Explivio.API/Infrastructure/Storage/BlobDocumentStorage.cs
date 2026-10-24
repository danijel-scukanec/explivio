using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Explivio.API.Infrastructure.Storage;

/// <summary>
/// F24: trip-document storage backed by Azure Blob Storage (Azurite locally). One private container
/// holds every trip's documents; each blob is keyed "{tripId}/{documentId}" so a trip's files group
/// under a prefix and a delete targets exactly one. Content type travels with the blob. Mirrors
/// <see cref="BlobPhotoStorage"/>.
/// </summary>
public sealed class BlobDocumentStorage(BlobServiceClient blobServiceClient) : IDocumentStorage
{
    private const string ContainerName = "trip-documents";

    public async Task UploadAsync(
        Guid tripId, Guid documentId, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(tripId, documentId, createContainer: true, cancellationToken);
        await blob.UploadAsync(
            content,
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } },
            cancellationToken);
    }

    public async Task<StoredDocument?> OpenAsync(Guid tripId, Guid documentId, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(tripId, documentId, createContainer: false, cancellationToken);
        try
        {
            var response = await blob.DownloadStreamingAsync(cancellationToken: cancellationToken);
            var contentType = response.Value.Details.ContentType ?? "application/octet-stream";
            return new StoredDocument(response.Value.Content, contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == StatusCodes.Status404NotFound)
        {
            return null;
        }
    }

    public async Task DeleteAsync(Guid tripId, Guid documentId, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(tripId, documentId, createContainer: false, cancellationToken);
        await blob.DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    private async Task<BlobClient> GetBlobAsync(
        Guid tripId, Guid documentId, bool createContainer, CancellationToken cancellationToken)
    {
        var container = blobServiceClient.GetBlobContainerClient(ContainerName);
        if (createContainer)
            await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        return container.GetBlobClient($"{tripId}/{documentId}");
    }
}
