using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Recap;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F29: the trip-recap read endpoint — the stored recap plus the photo gallery built from the trip's
// cover + image documents. Generation runs on the SignalR hub and is verified live (as with the F13/
// F16 hubs); here we cover the deterministic read side: empty before generation, the cover shows up in
// the gallery, and a stored recap is returned.
public sealed class RecapTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly ExplivioApiFactory _factory = factory;
    private readonly HttpClient _client = factory.CreateClient();

    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    [Fact]
    public async Task Recap_before_generation_is_empty_with_no_photos()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(_client, ct);

        var recap = await _client.GetFromJsonAsync<RecapDto>($"/v1/trips/{tripId}/recap", ct);

        Assert.NotNull(recap);
        Assert.Null(recap!.Content);
        Assert.Null(recap.GeneratedAtUtc);
        Assert.Empty(recap.Photos);
    }

    [Fact]
    public async Task Recap_gallery_includes_the_cover_photo()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(_client, ct);

        var upload = await _client.PostAsync($"/v1/trips/{tripId}/cover", ImageContent(TinyPng, "image/png"), ct);
        Assert.Equal(HttpStatusCode.NoContent, upload.StatusCode);

        var recap = await _client.GetFromJsonAsync<RecapDto>($"/v1/trips/{tripId}/recap", ct);

        var cover = Assert.Single(recap!.Photos);
        Assert.Equal("cover", cover.Kind);
        Assert.Equal($"/v1/trips/{tripId}/cover", cover.Url);
    }

    [Fact]
    public async Task Stored_recap_is_returned()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(_client, ct);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var recap = new TripRecap { TripId = tripId };
            recap.Set("We wandered Lisbon's hills and came home happy.", "test-model");
            db.TripRecaps.Add(recap);
            await db.SaveChangesAsync(ct);
        }

        var dto = await _client.GetFromJsonAsync<RecapDto>($"/v1/trips/{tripId}/recap", ct);

        Assert.Equal("We wandered Lisbon's hills and came home happy.", dto!.Content);
        Assert.Equal("test-model", dto.Model);
        Assert.NotNull(dto.GeneratedAtUtc);
    }

    private static async Task<Guid> CreateTripAsync(HttpClient client, CancellationToken ct)
    {
        var create = await client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Recap Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 2,
            stops = new[] { new { place = "Lisbon" } },
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
    private sealed record RecapDto(string? Content, DateTime? GeneratedAtUtc, string? Model, IReadOnlyList<PhotoDto> Photos);
    private sealed record PhotoDto(string Url, string Kind);
}
