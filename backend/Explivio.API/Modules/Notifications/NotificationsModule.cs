using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.ReadModel;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Notifications;

// F20: the current user's in-app notification feed. Notifications are written by the Notifications
// Worker into the read model; these endpoints only read them and mark them read. User-scoped (by the
// sub claim), not trip-scoped — a user's feed spans all their trips.
public static class NotificationsModule
{
    public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/notifications").RequireAuthorization();

        // The feed: newest first, capped, plus the unread count for the badge.
        group.MapGet("/", async (HttpContext ctx, ReadDbContext db, CancellationToken token) =>
        {
            var userId = ctx.GetUserId();
            var items = await db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .Select(n => new NotificationResponse(
                    n.Id, n.TripId, n.TripName, n.Kind, n.Detail, n.ActorUserId, n.CreatedAt, n.IsRead))
                .ToListAsync(token);

            var unread = await db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead, token);
            return Results.Ok(new NotificationsResponse(unread, items));
        }).Produces<NotificationsResponse>();

        // Mark one notification read (only your own; a foreign/unknown id → 404).
        group.MapPost("/{id:guid}/read", async (Guid id, HttpContext ctx, ReadDbContext db, CancellationToken token) =>
        {
            var userId = ctx.GetUserId();
            var updated = await db.Notifications
                .Where(n => n.Id == id && n.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), token);
            return updated == 0 ? Results.NotFound() : Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        // Mark all of the current user's notifications read.
        group.MapPost("/read-all", async (HttpContext ctx, ReadDbContext db, CancellationToken token) =>
        {
            var userId = ctx.GetUserId();
            await db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), token);
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent);

        return app;
    }
}

public record NotificationResponse(
    Guid Id, Guid TripId, string TripName, string Kind, string? Detail,
    Guid ActorUserId, DateTime CreatedAt, bool IsRead);

public record NotificationsResponse(int UnreadCount, IReadOnlyList<NotificationResponse> Items);
