using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.Cover;

// F22: a trip's cover photo. Upload/serve/delete run directly against storage + AppDbContext (no
// MediatR) because they stream file bytes, matching the direct-endpoint style of TripMembers.
// Served through the API behind the same RequireTripRole seam as every other trip route, so a cover
// is only visible to members of the trip.
public static class TripCoverEndpoints
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly HashSet<string> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    public static IEndpointRouteBuilder MapTripCoverEndpoints(this RouteGroupBuilder group)
    {
        // Upload or replace the cover. Editor+ (it's an edit to the trip).
        group.MapPost("/{id:guid}/cover", async (
            Guid id, [FromForm] IFormFile file, [FromServices] IPhotoStorage? storage,
            [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            if (storage is null)
                return Results.Problem("Cover photo storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);

            if (file.Length is 0 or > MaxBytes)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = [$"The image must be between 1 byte and {MaxBytes / (1024 * 1024)} MB."],
                });

            if (!AllowedContentTypes.Contains(file.ContentType))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = ["The image must be a JPEG, PNG, or WebP."],
                });

            var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == id, ct);
            if (trip is null)
                return Results.NotFound();

            await using var stream = file.OpenReadStream();
            await storage.UploadCoverAsync(id, stream, file.ContentType, ct);

            trip.SetCoverPhoto();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
        .DisableAntiforgery()
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        // Stream the cover image. Viewer+ — enforced by the filter, so the <img> request is
        // authorized the same way as the rest of the trip.
        group.MapGet("/{id:guid}/cover", async (Guid id, [FromServices] IPhotoStorage? storage, CancellationToken ct) =>
        {
            if (storage is null)
                return Results.NotFound();

            var cover = await storage.OpenCoverAsync(id, ct);
            return cover is null
                ? Results.NotFound()
                : Results.Stream(cover.Content, cover.ContentType);
        })
        .AddEndpointFilter(new RequireTripRole(TripRole.Viewer, "id"))
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound);

        // Remove the cover. Editor+.
        group.MapDelete("/{id:guid}/cover", async (
            Guid id, [FromServices] IPhotoStorage? storage, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == id, ct);
            if (trip is null)
                return Results.NotFound();

            if (storage is not null)
                await storage.DeleteCoverAsync(id, ct);

            trip.ClearCoverPhoto();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status404NotFound);

        return group;
    }
}
