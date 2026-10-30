using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Modules.Documents;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.Recap;

// F29: read side of the trip recap. Generation + persistence happen on the TripRecapHub; this just
// serves the stored recap plus a photo gallery built from images the trip already has — the cover
// photo and any image-type trip documents (F24). No new upload concept: the recap reuses what's there.
public static class RecapModule
{
    public static IEndpointRouteBuilder MapRecapModule(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/recap").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db, CancellationToken ct) =>
        {
            var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == tripId, ct);
            if (trip is null) return Results.NotFound();

            var recap = await db.TripRecaps.FirstOrDefaultAsync(r => r.TripId == tripId, ct);

            var photos = new List<RecapPhoto>();
            if (trip.HasCoverPhoto)
            {
                photos.Add(new RecapPhoto($"/v1/trips/{tripId}/cover", "cover"));
            }

            var imageDocs = await db.TripDocuments
                .Where(d => d.TripId == tripId && d.ContentType.StartsWith("image/"))
                .OrderBy(d => d.UploadedAt)
                .Select(d => d.Id)
                .ToListAsync(ct);
            photos.AddRange(imageDocs.Select(id =>
                new RecapPhoto($"/v1/trips/{tripId}/documents/{id}/content", "document")));

            return Results.Ok(new RecapResponse(
                recap?.Content, recap?.GeneratedAtUtc, recap?.Model, photos));
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.AiTripRecap))
        .AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
        .Produces<RecapResponse>();

        return app;
    }
}

// A stored recap (null fields when none has been generated yet) plus the photos the recap page shows.
public record RecapResponse(
    string? Content, DateTime? GeneratedAtUtc, string? Model, IReadOnlyList<RecapPhoto> Photos);

// A gallery image, as an API-relative path the client turns into an <img> source. Kind is "cover" or
// "document" so the UI can label or order them.
public record RecapPhoto(string Url, string Kind);
