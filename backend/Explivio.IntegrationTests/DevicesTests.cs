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
}
