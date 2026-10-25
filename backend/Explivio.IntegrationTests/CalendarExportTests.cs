using System.Net;
using System.Net.Http.Json;
using System.Text;
using Xunit;

namespace Explivio.IntegrationTests;

// F27: the calendar export endpoints through the real HTTP pipeline. Covers the authed per-trip
// download (ics + pdf), the anonymous share-token feed, and the 404 paths (missing trip, bad/revoked
// token, non-member).
public sealed class CalendarExportTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Ics_export_returns_a_calendar_with_an_event_per_activity()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        await AddActivityAsync(tripId, "Visit Belém Tower", "2026-11-01", "10:00", ct);
        await AddActivityAsync(tripId, "Tram 28 ride", "2026-11-02", null, ct);

        var res = await _client.GetAsync($"/v1/trips/{tripId}/calendar/export?format=ics", ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("text/calendar", res.Content.Headers.ContentType!.MediaType);

        var text = await res.Content.ReadAsStringAsync(ct);
        Assert.Contains("BEGIN:VCALENDAR", text);
        Assert.Contains("SUMMARY:Visit Belém Tower", text);
        Assert.Contains("SUMMARY:Tram 28 ride", text);
        Assert.Equal(2, CountOf(text, "BEGIN:VEVENT"));
    }

    [Fact]
    public async Task Pdf_export_returns_a_pdf_file()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        await AddActivityAsync(tripId, "Visit Belém Tower", "2026-11-01", "10:00", ct);

        var res = await _client.GetAsync($"/v1/trips/{tripId}/calendar/export?format=pdf", ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("application/pdf", res.Content.Headers.ContentType!.MediaType);
        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
        Assert.True(bytes.Length > 0);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public async Task Export_for_an_unknown_trip_is_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var res = await _client.GetAsync($"/v1/trips/{Guid.NewGuid()}/calendar/export", ct);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Feed_resolves_by_share_token_without_auth_and_404s_once_revoked()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        await AddActivityAsync(tripId, "Visit Belém Tower", "2026-11-01", "10:00", ct);

        var token = (await (await _client.PostAsync($"/v1/trips/{tripId}/share", null, ct))
            .Content.ReadFromJsonAsync<ShareDto>(ct))!.ShareToken;

        var feed = await _client.GetAsync($"/v1/calendar/{token}.ics", ct);
        Assert.Equal(HttpStatusCode.OK, feed.StatusCode);
        Assert.Equal("text/calendar", feed.Content.Headers.ContentType!.MediaType);
        Assert.Contains("SUMMARY:Visit Belém Tower", await feed.Content.ReadAsStringAsync(ct));

        await _client.DeleteAsync($"/v1/trips/{tripId}/share", ct);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/v1/calendar/{token}.ics", ct)).StatusCode);
    }

    [Fact]
    public async Task Feed_for_an_unknown_token_is_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var res = await _client.GetAsync("/v1/calendar/not-a-real-token.ics", ct);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task A_non_member_cannot_export_a_private_trip()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var req = new HttpRequestMessage(HttpMethod.Get, $"/v1/trips/{tripId}/calendar/export");
        req.Headers.Add("X-Dev-User", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(req, ct)).StatusCode);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Calendar Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 2,
            stops = new[] { new { place = "Lisbon" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        return (await create.Content.ReadFromJsonAsync<CreatedDto>(ct))!.Id;
    }

    private async Task AddActivityAsync(Guid tripId, string name, string date, string? startTime, CancellationToken ct)
    {
        var res = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/activities", new
        {
            name,
            date,
            startTime,
            category = "Sightseeing",
        }, ct);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    private static int CountOf(string haystack, string needle)
    {
        var count = 0;
        var i = 0;
        while ((i = haystack.IndexOf(needle, i, StringComparison.Ordinal)) >= 0)
        {
            count++;
            i += needle.Length;
        }
        return count;
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record ShareDto(string ShareToken);
}
