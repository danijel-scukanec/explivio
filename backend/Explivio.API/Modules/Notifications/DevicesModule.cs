using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Notifications;

// F20 (push): register/unregister the current user's push devices. The mobile client posts its Expo
// push token after sign-in and deletes it on sign-out; the Notifications Worker reads these rows to
// send push. User-scoped (by the sub claim) and gated behind the PushNotifications feature flag — the
// client learns the feature is on via GET /features and only then registers.
public static class DevicesModule
{
    public static IEndpointRouteBuilder MapDeviceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/devices")
            .RequireAuthorization()
            .AddEndpointFilter(new RequireFeature(FeatureFlags.PushNotifications));

        // Register (or refresh) a device token for the current user. Upsert by token: a token is unique
        // to a physical device, so if it already exists we re-point it at the caller (the device may
        // have changed hands) and bump LastSeenAt rather than inserting a duplicate.
        group.MapPost("/", async (RegisterDeviceRequest body, HttpContext ctx, ReadDbContext db, CancellationToken token) =>
        {
            if (string.IsNullOrWhiteSpace(body.Token)) return Results.BadRequest();

            var userId = ctx.GetUserId();
            var now = DateTime.UtcNow;
            var platform = string.IsNullOrWhiteSpace(body.Platform) ? "unknown" : body.Platform.Trim().ToLowerInvariant();

            var existing = await db.PushDevices.FirstOrDefaultAsync(d => d.ExpoPushToken == body.Token, token);
            if (existing is null)
            {
                db.PushDevices.Add(new PushDevice
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ExpoPushToken = body.Token,
                    Platform = platform,
                    CreatedAt = now,
                    LastSeenAt = now,
                });
            }
            else
            {
                existing.UserId = userId;
                existing.Platform = platform;
                existing.LastSeenAt = now;
            }

            await db.SaveChangesAsync(token);
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status400BadRequest);

        // Unregister a device (on sign-out). Only removes the caller's own token; an unknown or foreign
        // token is a no-op 204 — the goal state (the token is not registered to this user) is reached.
        group.MapDelete("/", async (string token, HttpContext ctx, ReadDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(token)) return Results.BadRequest();

            var userId = ctx.GetUserId();
            await db.PushDevices
                .Where(d => d.ExpoPushToken == token && d.UserId == userId)
                .ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status400BadRequest);

        return app;
    }
}

public record RegisterDeviceRequest(string Token, string? Platform);
