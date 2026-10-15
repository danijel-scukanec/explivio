using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F22: end-to-end coverage of the trip cover-photo endpoints through the real HTTP pipeline, SQL,
// and the Azurite blob emulator started by the test factory.
public sealed class TripCoverTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    // A valid 1x1 PNG.
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    [Fact]
    public async Task Upload_cover_then_get_streams_it_and_flags_the_trip()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        // Before upload: no cover.
        var before = await _client.GetFromJsonAsync<TripResponse>($"/v1/trips/{tripId}", ct);
        Assert.False(before!.HasCoverPhoto);

        var upload = await _client.PostAsync($"/v1/trips/{tripId}/cover", ImageContent(TinyPng, "image/png"), ct);
        Assert.Equal(HttpStatusCode.NoContent, upload.StatusCode);

        // The read model now reports a cover.
        var after = await _client.GetFromJsonAsync<TripResponse>($"/v1/trips/{tripId}", ct);
        Assert.True(after!.HasCoverPhoto);

        // And it streams back with the stored content type and bytes.
        var get = await _client.GetAsync($"/v1/trips/{tripId}/cover", ct);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("image/png", get.Content.Headers.ContentType?.MediaType);
        Assert.Equal(TinyPng, await get.Content.ReadAsByteArrayAsync(ct));
    }

    [Fact]
    public async Task Upload_cover_with_non_image_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var upload = await _client.PostAsync(
            $"/v1/trips/{tripId}/cover", ImageContent("not an image"u8.ToArray(), "text/plain"), ct);

        Assert.Equal(HttpStatusCode.BadRequest, upload.StatusCode);
    }

    [Fact]
    public async Task Get_cover_when_none_returns_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var get = await _client.GetAsync($"/v1/trips/{tripId}/cover", ct);
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Cover Trip",
            destination = "Porto",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private static MultipartFormDataContent ImageContent(byte[] bytes, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", "cover" } };
    }

    private sealed record CreatedResponse(Guid Id);

    private sealed record TripResponse(Guid Id, string Name, bool HasCoverPhoto);
}
