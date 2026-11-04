using System.Net;
using System.Net.Http.Json;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Explivio.IntegrationTests;

// F20 (push): the device register/unregister endpoints. Tokens are stored in the read schema and read
// by the Notifications Worker to send push (the send itself needs the Service Bus broker + Expo, so it
// is verified live, like the in-app worker write in NotificationsTests).
public sealed class DevicesTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly ExplivioApiFactory _factory = factory;

    [Fact]
    public async Task Register_stores_the_token_for_the_caller()
    {
        var ct = TestContext.Current.CancellationToken;
        var user = Guid.NewGuid();
        var token = $"ExponentPushToken[{Guid.NewGuid():N}]";

        var res = await RegisterAsync(user, token, "android", ct);
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        var device = await FindAsync(token, ct);
        Assert.NotNull(device);
        Assert.Equal(user, device!.UserId);
        Assert.Equal("android", device.Platform);
    }

    [Fact]
    public async Task Re_registering_the_same_token_upserts_rather_than_duplicating()
    {
        var ct = TestContext.Current.CancellationToken;
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var token = $"ExponentPushToken[{Guid.NewGuid():N}]";

        await RegisterAsync(first, token, "android", ct);
        await RegisterAsync(second, token, "ios", ct);   // same device, now a different user

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
        var rows = await db.PushDevices.Where(d => d.ExpoPushToken == token).ToListAsync(ct);

        Assert.Single(rows);                 // one physical device → one row
        Assert.Equal(second, rows[0].UserId); // re-pointed at the latest caller
        Assert.Equal("ios", rows[0].Platform);
    }

    [Fact]
    public async Task Unregister_removes_only_the_callers_own_token()
    {
        var ct = TestContext.Current.CancellationToken;
        var owner = Guid.NewGuid();
        var other = Guid.NewGuid();
        var token = $"ExponentPushToken[{Guid.NewGuid():N}]";
        await RegisterAsync(owner, token, "android", ct);

        // A different user can't delete it — no-op 204, row remains.
        Assert.Equal(HttpStatusCode.NoContent, (await UnregisterAsync(other, token, ct)).StatusCode);
        Assert.NotNull(await FindAsync(token, ct));

        // The owner removes it.
        Assert.Equal(HttpStatusCode.NoContent, (await UnregisterAsync(owner, token, ct)).StatusCode);
        Assert.Null(await FindAsync(token, ct));
    }

    [Fact]
    public async Task Register_with_a_blank_token_is_a_400()
    {
        var ct = TestContext.Current.CancellationToken;
        var res = await RegisterAsync(Guid.NewGuid(), "", "android", ct);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // --- F20 (web push): browser subscription endpoints ---

    [Fact]
    public async Task Register_web_stores_the_subscription_for_the_caller()
    {
        var ct = TestContext.Current.CancellationToken;
        var user = Guid.NewGuid();
        var endpoint = $"https://push.example.com/{Guid.NewGuid():N}";

        var res = await RegisterWebAsync(user, endpoint, "p256dh-key", "auth-secret", ct);
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        var sub = await FindWebAsync(endpoint, ct);
        Assert.NotNull(sub);
        Assert.Equal(user, sub!.UserId);
        Assert.Equal("p256dh-key", sub.P256dh);
        Assert.Equal("auth-secret", sub.Auth);
    }

    [Fact]
    public async Task Re_registering_the_same_endpoint_upserts_rather_than_duplicating()
    {
        var ct = TestContext.Current.CancellationToken;
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var endpoint = $"https://push.example.com/{Guid.NewGuid():N}";

        await RegisterWebAsync(first, endpoint, "k1", "a1", ct);
        await RegisterWebAsync(second, endpoint, "k2", "a2", ct);   // same browser, re-subscribed

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
        var rows = await db.WebPushSubscriptions.Where(s => s.Endpoint == endpoint).ToListAsync(ct);

        Assert.Single(rows);                 // one browser profile → one row
        Assert.Equal(second, rows[0].UserId); // re-pointed at the latest caller
        Assert.Equal("k2", rows[0].P256dh);   // keys refreshed
    }

    [Fact]
    public async Task Unregister_web_removes_only_the_callers_own_subscription()
    {
        var ct = TestContext.Current.CancellationToken;
        var owner = Guid.NewGuid();
        var other = Guid.NewGuid();
        var endpoint = $"https://push.example.com/{Guid.NewGuid():N}";
        await RegisterWebAsync(owner, endpoint, "k", "a", ct);

        // A different user can't delete it — no-op 204, row remains.
        Assert.Equal(HttpStatusCode.NoContent, (await UnregisterWebAsync(other, endpoint, ct)).StatusCode);
        Assert.NotNull(await FindWebAsync(endpoint, ct));

        // The owner removes it.
        Assert.Equal(HttpStatusCode.NoContent, (await UnregisterWebAsync(owner, endpoint, ct)).StatusCode);
        Assert.Null(await FindWebAsync(endpoint, ct));
    }

    [Fact]
    public async Task Register_web_with_a_missing_key_is_a_400()
    {
        var ct = TestContext.Current.CancellationToken;
        var res = await RegisterWebAsync(Guid.NewGuid(), "https://push.example.com/x", "", "auth", ct);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Vapid_key_endpoint_returns_the_configured_public_key()
    {
        var ct = TestContext.Current.CancellationToken;
        var req = new HttpRequestMessage(HttpMethod.Get, "/v1/devices/web/vapid-key");
        req.Headers.Add("X-Dev-User", Guid.NewGuid().ToString());

        var res = await _client.SendAsync(req, ct);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<VapidKeyDto>(ct);
        Assert.NotNull(body);           // key is empty in tests (web push unconfigured), but the shape is served
    }

    private Task<HttpResponseMessage> RegisterAsync(Guid user, string token, string platform, CancellationToken ct)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/devices")
        {
            Content = JsonContent.Create(new { token, platform }),
        };
        req.Headers.Add("X-Dev-User", user.ToString());
        return _client.SendAsync(req, ct);
    }

    private Task<HttpResponseMessage> UnregisterAsync(Guid user, string token, CancellationToken ct)
    {
        var req = new HttpRequestMessage(HttpMethod.Delete, $"/v1/devices?token={Uri.EscapeDataString(token)}");
        req.Headers.Add("X-Dev-User", user.ToString());
        return _client.SendAsync(req, ct);
    }

    private async Task<PushDevice?> FindAsync(string token, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
        return await db.PushDevices.AsNoTracking().FirstOrDefaultAsync(d => d.ExpoPushToken == token, ct);
    }

    private Task<HttpResponseMessage> RegisterWebAsync(
        Guid user, string endpoint, string p256dh, string auth, CancellationToken ct)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/devices/web")
        {
            Content = JsonContent.Create(new { endpoint, p256dh, auth }),
        };
        req.Headers.Add("X-Dev-User", user.ToString());
        return _client.SendAsync(req, ct);
    }

    private Task<HttpResponseMessage> UnregisterWebAsync(Guid user, string endpoint, CancellationToken ct)
    {
        var req = new HttpRequestMessage(
            HttpMethod.Delete, $"/v1/devices/web?endpoint={Uri.EscapeDataString(endpoint)}");
        req.Headers.Add("X-Dev-User", user.ToString());
        return _client.SendAsync(req, ct);
    }

    private async Task<WebPushSubscription?> FindWebAsync(string endpoint, CancellationToken ct)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
        return await db.WebPushSubscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.Endpoint == endpoint, ct);
    }

    private sealed record VapidKeyDto(string PublicKey);
}
