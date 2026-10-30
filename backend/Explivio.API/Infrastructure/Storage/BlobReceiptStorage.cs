using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Explivio.API.Infrastructure.Storage;

/// <summary>
/// F17: receipt-image storage backed by Azure Blob Storage (Azurite locally). One private container
/// holds every receipt; each expense has at most one, named by its id, so a re-upload overwrites.
/// The content type travels with the blob. A near-verbatim twin of <see cref="BlobPhotoStorage"/>.
/// </summary>
public sealed class BlobReceiptStorage(BlobServiceClient blobServiceClient) : IReceiptStorage
{
    private const string ContainerName = "expense-receipts";

    public async Task UploadReceiptAsync(Guid expenseId, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(expenseId, createContainer: true, cancellationToken);
        await blob.UploadAsync(
            content,
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } },
            cancellationToken);
    }

    public async Task<ReceiptImage?> OpenReceiptAsync(Guid expenseId, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(expenseId, createContainer: false, cancellationToken);
        try
        {
            var response = await blob.DownloadStreamingAsync(cancellationToken: cancellationToken);
            var contentType = response.Value.Details.ContentType ?? "application/octet-stream";
            return new ReceiptImage(response.Value.Content, contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == StatusCodes.Status404NotFound)
        {
            return null;
        }
    }

    public async Task DeleteReceiptAsync(Guid expenseId, CancellationToken cancellationToken)
    {
        var blob = await GetBlobAsync(expenseId, createContainer: false, cancellationToken);
        await blob.DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    private async Task<BlobClient> GetBlobAsync(Guid expenseId, bool createContainer, CancellationToken cancellationToken)
    {
        var container = blobServiceClient.GetBlobContainerClient(ContainerName);
        if (createContainer)
            await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        return container.GetBlobClient(expenseId.ToString());
    }
}
