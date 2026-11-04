using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Social;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.GetTrip;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Gallery;

// F26: the public trip gallery and share-link viewing. These are NOT trip-membership gated — the
// gallery is public (a trip is in it because its owner published it) and a share link grants read
// access by possession of the token. The list is served from the TripPopularity read model (F08-style
// CQRS); the detail / shared views read the trip itself for its full route.
public static class GalleryModule
{
    public static IEndpointRouteBuilder MapGalleryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/gallery").RequireAuthorization();

        // Browse public trips, most-liked first. Served from the read model; paged.
        group.MapGet("/", async (AppDbContext db, ReadDbContext read, HttpContext ctx,
            int? skip, int? take, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            var (page, offset) = Paging(skip, take);

            var rows = await read.TripPopularity
                .Where(p => p.IsPublic)
                .OrderByDescending(p => p.LikeCount).ThenByDescending(p => p.UpdatedAt)
                .Skip(offset).Take(page)
                .ToListAsync(ct);

            return Results.Ok(await MapAsync(db, rows, userId, ct));
        }).Produces<IEnumerable<GalleryItemResponse>>();

        // F26 (follow): the "Following" feed — public trips from owners the caller follows, newest first.
        group.MapGet("/following", async (AppDbContext db, ReadDbContext read, HttpContext ctx,
            int? skip, int? take, CancellationToken ct) =>
        {
            var userId = ctx.GetUserId();
            var (page, offset) = Paging(skip, take);

            var followedOwnerIds = await db.UserFollows
                .Where(f => f.FollowerUserId == userId)
                .Select(f => f.FollowedUserId)
                .ToListAsync(ct);
            if (followedOwnerIds.Count == 0) return Results.Ok(Array.Empty<GalleryItemResponse>());

            var rows = await read.TripPopularity
                .Where(p => p.IsPublic && followedOwnerIds.Contains(p.OwnerUserId))
                .OrderByDescending(p => p.UpdatedAt)
                .Skip(offset).Take(page)
                .ToListAsync(ct);

            return Results.Ok(await MapAsync(db, rows, userId, ct));
        }).Produces<IEnumerable<GalleryItemResponse>>();

        // A public trip's full detail (route included), for viewing/cloning. 404 if not public.
        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var trip = await db.Trips
                .Include(t => t.Stops)
                .FirstOrDefaultAsync(t => t.Id == id && t.IsPublic, ct);
            return trip is null ? Results.NotFound() : Results.Ok(trip.ToResponse());
        }).Produces<TripResponse>().Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static (int Page, int Offset) Paging(int? skip, int? take) =>
        (Math.Clamp(take ?? 24, 1, 100), Math.Max(0, skip ?? 0));

    // F26: map a page of TripPopularity read-model rows to gallery cards, resolving the per-viewer flags
    // and owner names from the write model in one round trip each (liked, followed, owner display name).
    // Shared by the gallery list, the Following feed, and a user's profile trips.
    internal static async Task<IReadOnlyList<GalleryItemResponse>> MapAsync(
        AppDbContext db, IReadOnlyList<TripPopularity> rows, Guid userId, CancellationToken ct)
    {
        if (rows.Count == 0) return [];

        var tripIds = rows.Select(r => r.TripId).ToList();
        var ownerIds = rows.Select(r => r.OwnerUserId).Distinct().ToList();

        var liked = (await db.TripLikes
            .Where(l => l.UserId == userId && tripIds.Contains(l.TripId))
            .Select(l => l.TripId)
            .ToListAsync(ct)).ToHashSet();

        var followed = (await db.UserFollows
            .Where(f => f.FollowerUserId == userId && ownerIds.Contains(f.FollowedUserId))
            .Select(f => f.FollowedUserId)
            .ToListAsync(ct)).ToHashSet();

        var ownerNames = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        return rows.Select(r => new GalleryItemResponse(
            r.TripId, r.Name, r.Destination, r.StartDate, r.EndDate,
            r.TravelerCount, r.HasCoverPhoto, r.LikeCount, liked.Contains(r.TripId),
            r.OwnerUserId,
            ownerNames.TryGetValue(r.OwnerUserId, out var name) ? name : string.Empty,
            followed.Contains(r.OwnerUserId),
            r.OwnerUserId == userId)).ToList();
    }

    // F26: view a trip by its share token — grants read access regardless of membership or publicity.
    // Mapped on the /trips group (literal "shared" segment doesn't clash with the {id:guid} route).
    public static IEndpointRouteBuilder MapSharedTripEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/trips/shared/{token}", async (string token, AppDbContext db, CancellationToken ct) =>
        {
            var trip = await db.Trips
                .Include(t => t.Stops)
                .FirstOrDefaultAsync(t => t.ShareToken == token, ct);
            return trip is null ? Results.NotFound() : Results.Ok(trip.ToResponse());
        }).RequireAuthorization()
          .Produces<TripResponse>().Produces(StatusCodes.Status404NotFound);
        return app;
    }
}
