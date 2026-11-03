using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F15: pending invites. Inviting an email with no account records a TripInvite (claimed into a
// membership on that person's first sign-in — the claim path is verified live, since the test harness
// authenticates via the dev-identity header without an email claim to provision from). Inviting an
// existing account adds them straight away, as before.
public sealed class TripInvitesTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Inviting_an_accountless_email_records_a_pending_invite()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        var email = $"nobody-{Guid.NewGuid():N}@example.com";

        var res = await InviteAsync(tripId, email, "Editor", ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var result = await res.Content.ReadFromJsonAsync<InviteResultDto>(Web, ct);
        Assert.True(result!.Pending);
        Assert.Null(result.Member);

        var invites = await ListInvitesAsync(tripId, ct);
        var invite = Assert.Single(invites);
        Assert.Equal(email, invite.Email);
        Assert.Equal("Editor", invite.Role);

        // The invitee is NOT yet a member (they haven't signed in to claim it).
        var members = await ListMembersAsync(tripId, ct);
        Assert.DoesNotContain(members, m => string.Equals(m.Email, email, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Re_inviting_the_same_email_updates_the_role_without_duplicating()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        var email = $"again-{Guid.NewGuid():N}@example.com";

        await InviteAsync(tripId, email, "Viewer", ct);
        await InviteAsync(tripId, email, "Editor", ct);

        var invites = await ListInvitesAsync(tripId, ct);
        var invite = Assert.Single(invites);          // one row, not two
        Assert.Equal("Editor", invite.Role);          // role updated
    }

    [Fact]
    public async Task Inviting_an_existing_account_adds_them_as_a_member_immediately()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        var (userId, email) = await SeedUserAsync(ct);

        var res = await InviteAsync(tripId, email, "Editor", ct);
        var result = await res.Content.ReadFromJsonAsync<InviteResultDto>(Web, ct);
        Assert.False(result!.Pending);
        Assert.Equal(userId, result.Member!.UserId);

        Assert.Empty(await ListInvitesAsync(tripId, ct));   // no pending invite created
        var members = await ListMembersAsync(tripId, ct);
        Assert.Contains(members, m => m.UserId == userId);
    }

    [Fact]
    public async Task Cancelling_a_pending_invite_removes_it()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);
        await InviteAsync(tripId, $"cancel-{Guid.NewGuid():N}@example.com", "Editor", ct);
        var invite = Assert.Single(await ListInvitesAsync(tripId, ct));

        var del = await _client.DeleteAsync($"/v1/trips/{tripId}/invites/{invite.Id}", ct);
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        Assert.Empty(await ListInvitesAsync(tripId, ct));
    }

    [Fact]
    public async Task A_non_owner_cannot_list_pending_invites()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);                 // owner = DevUser
        var viewer = Guid.NewGuid();
        var add = await _client.PostAsJsonAsync($"/v1/trips/{tripId}/members", new { userId = viewer, role = "Viewer" }, ct);
        Assert.Equal(HttpStatusCode.OK, add.StatusCode);

        var req = new HttpRequestMessage(HttpMethod.Get, $"/v1/trips/{tripId}/invites");
        req.Headers.Add("X-Dev-User", viewer.ToString());
        var res = await _client.SendAsync(req, ct);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    private Task<HttpResponseMessage> InviteAsync(Guid tripId, string email, string role, CancellationToken ct) =>
        _client.PostAsJsonAsync($"/v1/trips/{tripId}/members/invite", new { email, role }, ct);

    private async Task<List<InviteDto>> ListInvitesAsync(Guid tripId, CancellationToken ct)
    {
        var res = await _client.GetAsync($"/v1/trips/{tripId}/invites", ct);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<List<InviteDto>>(Web, ct))!;
    }

    private async Task<List<MemberDto>> ListMembersAsync(Guid tripId, CancellationToken ct)
    {
        var res = await _client.GetAsync($"/v1/trips/{tripId}/members", ct);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<List<MemberDto>>(Web, ct))!;
    }

    private async Task<(Guid UserId, string Email)> SeedUserAsync(CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var email = $"existing-{Guid.NewGuid():N}@example.com";
        var user = new User { Id = Guid.NewGuid(), Email = email, DisplayName = "Existing", CreatedAt = DateTime.UtcNow };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return (user.Id, email);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Invite Trip", startDate = "2026-11-01", endDate = "2026-11-03",
            travelerCount = 2, stops = new[] { new { place = "Lisbon" } }, userId = ExplivioApiFactory.DevUserId,
        }, ct);
        return (await create.Content.ReadFromJsonAsync<CreatedDto>(Web, ct))!.Id;
    }

    private sealed record CreatedDto(Guid Id);
    private sealed record InviteResultDto(bool Pending, MemberDto? Member);
    private sealed record InviteDto(Guid Id, string Email, string Role, DateTime CreatedAt);
    private sealed record MemberDto(Guid UserId, string Role, string? DisplayName, string? Email);
}
