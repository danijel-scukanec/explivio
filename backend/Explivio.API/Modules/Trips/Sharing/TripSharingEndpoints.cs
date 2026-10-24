using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.Sharing;

// F26: gallery visibility, share links, and likes. These run directly against AppDbContext (no
// MediatR) — short state changes on the Trip aggregate whose domain events flow to the gallery read
// model through the outbox. Visibility/share are membership-gated (RequireTripRole); like/unlike are
// cross-user by nature (you like someone else's public trip), so they are NOT RequireTripRole —
// they do their own "public or member" check instead.
public static class TripSharingEndpoints
{
    public static IEndpointRouteBuilder MapTripSharingEndpoints(this RouteGroupBuilder group)
    {
        // Publish to / remove from the public gallery. Owner-level (a publishing decision).
        group.MapPatch("/{id:guid}/visibility", async (
            Guid id, SetVisibilityRequest body, AppDbContext db, CancellationToken ct) =>
        {
            // Include the stops: Publish() carries the derived destination summary into the gallery
            // read model, and that's built from the trip's route.
            var trip = await db.Trips.Include(t => t.Stops).FirstOrDefaultAsync(t => t.Id == id, ct);
            if (trip is null) return Results.NotFound();

            if (body.IsPublic) trip.Publish();
            else trip.Unpublish();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner, "id"))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        // Mint (or return the existing) share link token. Editor+.
        group.MapPost("/{id:guid}/share", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == id, ct);
            if (trip is null) return Results.NotFound();

            var token = trip.EnsureShareToken();
            await db.SaveChangesAsync(ct);
            return Results.Ok(new ShareLinkResponse(token));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
          .Produces<ShareLinkResponse>().Produces(StatusCodes.Status404NotFound);

        // Revoke the share link. Editor+.
        group.MapDelete("/{id:guid}/share", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == id, ct);
            if (trip is null) return Results.NotFound();

            trip.RevokeShareToken();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        // Like a trip. Allowed on any public trip (or one you're a member of). Idempotent.
        group.MapPost("/{id:guid}/like", async (Guid id, AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            if (!await CanSeeAsync(db, id, userId, ct)) return Results.NotFound();

            var already = await db.TripLikes.AnyAsync(l => l.TripId == id && l.UserId == userId, ct);
            if (!already)
            {
                db.TripLikes.Add(TripLike.Create(id, userId));
                await db.SaveChangesAsync(ct);
            }
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        // Remove your like. Idempotent.
        group.MapDelete("/{id:guid}/like", async (Guid id, AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            var like = await db.TripLikes.FirstOrDefaultAsync(l => l.TripId == id && l.UserId == userId, ct);
            if (like is not null)
            {
                like.Unlike(); // raise the unlike event before removing the row
                db.TripLikes.Remove(like);
                await db.SaveChangesAsync(ct);
            }
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent);

        return group;
    }

    // A trip is visible to a user if it's public or they're a member of it.
    private static async Task<bool> CanSeeAsync(AppDbContext db, Guid tripId, Guid userId, CancellationToken ct)
    {
        var trip = await db.Trips
            .Where(t => t.Id == tripId)
            .Select(t => new { t.IsPublic })
            .FirstOrDefaultAsync(ct);
        if (trip is null) return false;
        if (trip.IsPublic) return true;
        return await db.TripMembers.AnyAsync(m => m.TripId == tripId && m.UserId == userId, ct);
    }

    private static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException());
}

public record SetVisibilityRequest(bool IsPublic);

public record ShareLinkResponse(string ShareToken);
