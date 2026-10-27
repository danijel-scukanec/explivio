using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.ReadModel;
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
            var page = Math.Clamp(take ?? 24, 1, 100);
            var offset = Math.Max(0, skip ?? 0);

            var rows = await read.TripPopularity
                .Where(p => p.IsPublic)
                .OrderByDescending(p => p.LikeCount).ThenByDescending(p => p.UpdatedAt)
                .Skip(offset).Take(page)
                .ToListAsync(ct);

            // Resolve which of this page the caller has liked (write model is the source of truth).
            var ids = rows.Select(r => r.TripId).ToList();
            var likedIds = await db.TripLikes
                .Where(l => l.UserId == userId && ids.Contains(l.TripId))
                .Select(l => l.TripId)
                .ToListAsync(ct);
            var liked = likedIds.ToHashSet();

            var items = rows.Select(r => new GalleryItemResponse(
                r.TripId, r.Name, r.Destination, r.StartDate, r.EndDate,
                r.TravelerCount, r.HasCoverPhoto, r.LikeCount, liked.Contains(r.TripId)));
            return Results.Ok(items);
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
