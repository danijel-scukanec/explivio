using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Infrastructure.Storage;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Documents;

// F24: trip documents. Like the F22 cover photo, upload/list/download/delete run directly against
// storage + AppDbContext (no MediatR) because they stream file bytes. Blob-backed and feature-gated:
// when "blobs" isn't configured the storage is null and writes/reads report 503/404 while the rest of
// the API is unaffected. Behind the same RequireTripRole seam as every other trip route.
public static class DocumentsModule
{
    private const long MaxBytes = 15 * 1024 * 1024; // 15 MB
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic",
        "text/plain", "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    public static IEndpointRouteBuilder MapDocumentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/documents").RequireAuthorization();

        // List a trip's documents (metadata only). Viewer+.
        group.MapGet("/", async (Guid tripId, AppDbContext db, CancellationToken ct) =>
        {
            var documents = await db.TripDocuments
                .Where(d => d.TripId == tripId)
                .OrderByDescending(d => d.UploadedAt)
                .Select(d => new DocumentResponse(
                    d.Id, d.TripId, d.FileName, d.ContentType, d.SizeBytes, d.UploadedAt))
                .ToListAsync(ct);
            return Results.Ok(documents);
        }).AddEndpointFilter(new RequireFeature(FeatureFlags.TripDocuments))
          .AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<IEnumerable<DocumentResponse>>();

        // Upload a document. Editor+.
        group.MapPost("/", async (
            Guid tripId, [FromForm] IFormFile file, [FromServices] IDocumentStorage? storage,
            [FromServices] AppDbContext db, [FromServices] ITripCollaborationNotifier collaboration,
            CancellationToken ct) =>
        {
            if (storage is null)
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);

            if (file.Length is 0 or > MaxBytes)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = [$"The file must be between 1 byte and {MaxBytes / (1024 * 1024)} MB."],
                });

            if (!AllowedContentTypes.Contains(file.ContentType))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = ["Unsupported file type. Allowed: PDF, images, text/CSV, Word, Excel."],
                });

            var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == tripId, ct);
            if (trip is null)
                return Results.NotFound();

            var fileName = Path.GetFileName(file.FileName);
            var document = TripDocument.Create(tripId, fileName, file.ContentType, file.Length);

            await using (var stream = file.OpenReadStream())
                await storage.UploadAsync(tripId, document.Id, stream, file.ContentType, ct);

            db.TripDocuments.Add(document);
            await db.SaveChangesAsync(ct);

            await collaboration.TripChangedAsync(tripId, "document.created", ct);
            return Results.Created(
                $"/trips/{tripId}/documents/{document.Id}",
                new DocumentResponse(document.Id, tripId, fileName, file.ContentType, file.Length, document.UploadedAt));
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.TripDocuments))
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
        .DisableAntiforgery()
        .Produces<DocumentResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        // Download a document's bytes. Viewer+.
        group.MapGet("/{id:guid}/content", async (
            Guid tripId, Guid id, [FromServices] IDocumentStorage? storage,
            [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            if (storage is null)
                return Results.NotFound();

            var document = await db.TripDocuments
                .FirstOrDefaultAsync(d => d.Id == id && d.TripId == tripId, ct);
            if (document is null)
                return Results.NotFound();

            var stored = await storage.OpenAsync(tripId, id, ct);
            return stored is null
                ? Results.NotFound()
                : Results.Stream(stored.Content, document.ContentType, fileDownloadName: document.FileName);
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.TripDocuments))
        .AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound);

        // Delete a document (metadata + blob). Editor+.
        group.MapDelete("/{id:guid}", async (
            Guid tripId, Guid id, [FromServices] IDocumentStorage? storage,
            [FromServices] AppDbContext db, [FromServices] ITripCollaborationNotifier collaboration,
            CancellationToken ct) =>
        {
            var document = await db.TripDocuments.FirstOrDefaultAsync(d => d.Id == id && d.TripId == tripId, ct);
            if (document is null)
                return Results.NotFound();

            if (storage is not null)
                await storage.DeleteAsync(tripId, id, ct);

            db.TripDocuments.Remove(document);
            await db.SaveChangesAsync(ct);

            await collaboration.TripChangedAsync(tripId, "document.deleted", ct);
            return Results.NoContent();
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.TripDocuments))
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }
}
