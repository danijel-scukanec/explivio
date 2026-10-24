using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F24: end-to-end coverage of the trip-document endpoints through the real HTTP pipeline, SQL, and
// the Azurite blob emulator started by the test factory.
public sealed class DocumentEndpointsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static readonly byte[] TinyPdf = "%PDF-1.4 fake document bytes"u8.ToArray();

    [Fact]
    public async Task Upload_list_download_then_delete()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        // Upload a document.
        var upload = await _client.PostAsync(
            $"/v1/trips/{tripId}/documents", FileContent(TinyPdf, "application/pdf", "ticket.pdf"), ct);
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var created = await upload.Content.ReadFromJsonAsync<DocumentDto>(ct);
        Assert.Equal("ticket.pdf", created!.FileName);
        Assert.Equal(TinyPdf.Length, created.SizeBytes);

        // List reports it.
        var list = await _client.GetFromJsonAsync<List<DocumentDto>>($"/v1/trips/{tripId}/documents", ct);
        Assert.NotNull(list);
        Assert.Single(list);
        Assert.Equal("ticket.pdf", list[0].FileName);
        Assert.Equal("application/pdf", list[0].ContentType);

        // Download streams back the stored bytes with the original filename.
        var download = await _client.GetAsync($"/v1/trips/{tripId}/documents/{created.Id}/content", ct);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("application/pdf", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal("ticket.pdf", download.Content.Headers.ContentDisposition?.FileNameStar
            ?? download.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
        Assert.Equal(TinyPdf, await download.Content.ReadAsByteArrayAsync(ct));

        // Delete removes it.
        var delete = await _client.DeleteAsync($"/v1/trips/{tripId}/documents/{created.Id}", ct);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var after = await _client.GetFromJsonAsync<List<DocumentDto>>($"/v1/trips/{tripId}/documents", ct);
        Assert.Empty(after!);
    }

    [Fact]
    public async Task Upload_unsupported_type_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var upload = await _client.PostAsync(
            $"/v1/trips/{tripId}/documents",
            FileContent("<html></html>"u8.ToArray(), "text/html", "page.html"), ct);
        Assert.Equal(HttpStatusCode.BadRequest, upload.StatusCode);
    }

    [Fact]
    public async Task Download_missing_document_returns_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var get = await _client.GetAsync($"/v1/trips/{tripId}/documents/{Guid.NewGuid()}/content", ct);
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Document Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            stops = new[] { new { place = "Porto" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private static MultipartFormDataContent FileContent(byte[] bytes, string contentType, string fileName)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private sealed record CreatedResponse(Guid Id);
    private sealed record DocumentDto(Guid Id, string FileName, string ContentType, long SizeBytes);
}
