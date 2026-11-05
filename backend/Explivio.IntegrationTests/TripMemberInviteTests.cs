using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F15: inviting members by email + the caller-role endpoint, through the real pipeline. Users are
// simulated with X-Dev-User; a real Users row (with an email to resolve) is seeded via /users/register.
public sealed class TripMemberInviteTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private static readonly Guid Owner = ExplivioApiFactory.DevUserId;
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, Guid user, object? body, CancellationToken ct)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Dev-User", user.ToString());
        if (body is not null) request.Content = JsonContent.Create(body);
        return await _client.SendAsync(request, ct);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var response = await Send(HttpMethod.Post, "/v1/trips", Owner, new
        {
            name = "Invite Trip",
            startDate = "2026-09-01",
            endDate = "2026-09-07",
            travelerCount = 2,
            stops = new[] { new { place = "Lisbon" } },
            userId = Owner,
        }, ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedDto>(ct);
        return created!.Id;
    }

    private async Task<Guid> RegisterUserAsync(string email, string name, CancellationToken ct)
    {
        var response = await Send(HttpMethod.Post, "/v1/users/register", Owner, new { email, displayName = name }, ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedDto>(ct);
        return created!.Id;
    }

    [Fact]
    public async Task Invite_by_email_adds_an_existing_user_as_a_member()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        var bobId = await RegisterUserAsync("bob@example.com", "Bob", ct);

        // Owner invites Bob by email (different casing — resolution is case-insensitive). Bob has an
        // account, so the invite adds him straight away (not pending).
        var invite = await Send(HttpMethod.Post, $"/v1/trips/{tripId}/members/invite", Owner,
            new { email = "BOB@example.com", role = "Editor" }, ct);
        Assert.Equal(HttpStatusCode.OK, invite.StatusCode);
        var result = await invite.Content.ReadFromJsonAsync<InviteResultDto>(ct);
        Assert.False(result!.Pending);
        Assert.NotNull(result.Member);
        Assert.Equal(bobId, result.Member!.UserId);
        Assert.Equal("Editor", result.Member.Role);
        Assert.Equal("bob@example.com", result.Member.Email);

        // Bob can now read the trip and (as Editor) add an activity.
        var get = await Send(HttpMethod.Get, $"/v1/trips/{tripId}", bobId, null, ct);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        var add = await Send(HttpMethod.Post, $"/v1/trips/{tripId}/activities", bobId,
            new { name = "Belém Tower", date = "2026-09-02", category = "Sightseeing" }, ct);
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);
    }

    [Fact]
    public async Task Invite_unknown_email_records_a_pending_invite()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        // F15: an email with no account doesn't 404 — it records a pending invite, claimed when that
        // person first signs in.
        var invite = await Send(HttpMethod.Post, $"/v1/trips/{tripId}/members/invite", Owner,
            new { email = "nobody@example.com", role = "Viewer" }, ct);
        Assert.Equal(HttpStatusCode.OK, invite.StatusCode);
        var result = await invite.Content.ReadFromJsonAsync<InviteResultDto>(ct);
        Assert.True(result!.Pending);
        Assert.Null(result.Member);

        // The pending invite shows up on the trip's invite list.
        var invites = await Send(HttpMethod.Get, $"/v1/trips/{tripId}/invites", Owner, null, ct);
        Assert.Equal(HttpStatusCode.OK, invites.StatusCode);
        var list = await invites.Content.ReadFromJsonAsync<List<TripInviteDto>>(ct);
        Assert.Contains(list!, i => i.Email == "nobody@example.com");
    }

    [Fact]
    public async Task Caller_role_reports_owner_and_editor()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        var bobId = await RegisterUserAsync("bob2@example.com", "Bob Two", ct);
        await Send(HttpMethod.Post, $"/v1/trips/{tripId}/members/invite", Owner,
            new { email = "bob2@example.com", role = "Editor" }, ct);

        var ownerRole = await Send(HttpMethod.Get, $"/v1/trips/{tripId}/members/me", Owner, null, ct);
        Assert.Equal(HttpStatusCode.OK, ownerRole.StatusCode);
        Assert.Equal("Owner", (await ownerRole.Content.ReadFromJsonAsync<RoleDto>(ct))!.Role);

        var editorRole = await Send(HttpMethod.Get, $"/v1/trips/{tripId}/members/me", bobId, null, ct);
        Assert.Equal("Editor", (await editorRole.Content.ReadFromJsonAsync<RoleDto>(ct))!.Role);
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record MemberDto(Guid UserId, string Role, string? DisplayName, string? Email);
    private sealed record InviteResultDto(bool Pending, MemberDto? Member);
    private sealed record TripInviteDto(Guid Id, string Email);
    private sealed record RoleDto(string Role);
}
