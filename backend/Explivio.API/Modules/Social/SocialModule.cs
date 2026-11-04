using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Gallery;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Social;

// F26 (follow): the social graph — follow/unfollow users and read a user's public profile. Follows are a
// plain write-model table (no events); the Following feed lives on the gallery group (GET /gallery/following).
// All endpoints are user-scoped by the sub claim and require auth.
public static class SocialModule
{
    public static IEndpointRouteBuilder MapSocialEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/users").RequireAuthorization();

        // Follow a user. Idempotent (unique index backs it); 400 on self-follow, 404 on unknown user.
        group.MapPost("/{id:guid}/follow", async (Guid id, HttpContext ctx, AppDbContext db, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            if (id == userId) return Results.BadRequest();
            if (!await db.Users.AnyAsync(u => u.Id == id, ct)) return Results.NotFound();

            var already = await db.UserFollows
                .AnyAsync(f => f.FollowerUserId == userId && f.FollowedUserId == id, ct);
            if (!already)
            {
                db.UserFollows.Add(new UserFollow
                {
                    Id = Guid.NewGuid(),
                    FollowerUserId = userId,
                    FollowedUserId = id,
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync(ct);
            }
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent)
          .Produces(StatusCodes.Status400BadRequest)
          .Produces(StatusCodes.Status404NotFound);

        // Unfollow a user. Idempotent — removing a follow that isn't there is a no-op 204.
        group.MapDelete("/{id:guid}/follow", async (Guid id, HttpContext ctx, AppDbContext db, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            await db.UserFollows
                .Where(f => f.FollowerUserId == userId && f.FollowedUserId == id)
                .ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent);

        // A user's public profile: display name, follower/following counts, and whether the caller follows them.
        group.MapGet("/{id:guid}/profile", async (Guid id, HttpContext ctx, AppDbContext db, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            var user = await db.Users
                .Where(u => u.Id == id)
                .Select(u => new { u.Id, u.DisplayName })
                .FirstOrDefaultAsync(ct);
            if (user is null) return Results.NotFound();

            var followers = await db.UserFollows.CountAsync(f => f.FollowedUserId == id, ct);
            var following = await db.UserFollows.CountAsync(f => f.FollowerUserId == id, ct);
            var followedByMe = await db.UserFollows
                .AnyAsync(f => f.FollowerUserId == userId && f.FollowedUserId == id, ct);

            return Results.Ok(new UserProfileResponse(
                user.Id, user.DisplayName, followers, following, followedByMe, id == userId));
        }).Produces<UserProfileResponse>().Produces(StatusCodes.Status404NotFound);

        // A user's public trips (gallery cards), newest first. Served from the gallery read model.
        group.MapGet("/{id:guid}/trips", async (Guid id, HttpContext ctx,
            AppDbContext db, ReadDbContext read, int? skip, int? take, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            var page = Math.Clamp(take ?? 24, 1, 100);
            var offset = Math.Max(0, skip ?? 0);

            var rows = await read.TripPopularity
                .Where(p => p.IsPublic && p.OwnerUserId == id)
                .OrderByDescending(p => p.UpdatedAt)
                .Skip(offset).Take(page)
                .ToListAsync(ct);

            return Results.Ok(await GalleryModule.MapAsync(db, rows, userId, ct));
        }).Produces<IEnumerable<GalleryItemResponse>>();

        return app;
    }
}

// F26: a user's public profile. IsMe lets the client hide the follow button on your own profile.
public record UserProfileResponse(
    Guid UserId,
    string DisplayName,
    int FollowerCount,
    int FollowingCount,
    bool FollowedByMe,
    bool IsMe);
