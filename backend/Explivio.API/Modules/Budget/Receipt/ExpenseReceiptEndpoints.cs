using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Infrastructure.Storage;
using Explivio.API.Modules.Trips;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Budget.Receipt;

// F17: a scanned receipt image attached to an expense. Upload/serve/delete run directly against
// storage + AppDbContext (no MediatR) because they stream file bytes — the same direct-endpoint style
// as trip cover photos (TripCoverEndpoints). Served behind the same RequireTripRole seam, so a
// receipt is only visible to members of the trip. The client uploads here AFTER creating the expense
// (create → attach), matching how the web cover upload works.
public static class ExpenseReceiptEndpoints
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly HashSet<string> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    public static RouteGroupBuilder MapExpenseReceiptEndpoints(this RouteGroupBuilder group)
    {
        // Upload or replace the receipt for an expense. Editor+.
        group.MapPost("/{expenseId:guid}/receipt", async (
            Guid tripId, Guid expenseId, [FromForm] IFormFile file,
            [FromServices] IReceiptStorage? storage, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            if (storage is null)
                return Results.Problem("Receipt storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);

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

            var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == expenseId && e.TripId == tripId, ct);
            if (expense is null)
                return Results.NotFound();

            await using var stream = file.OpenReadStream();
            await storage.UploadReceiptAsync(expenseId, stream, file.ContentType, ct);

            expense.SetReceipt();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.AiReceiptScanning))
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
        .DisableAntiforgery()
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        // Stream the receipt image. Viewer+ — the <img> request is authorized like the rest of the trip.
        group.MapGet("/{expenseId:guid}/receipt", async (
            Guid tripId, Guid expenseId, [FromServices] IReceiptStorage? storage, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            if (storage is null)
                return Results.NotFound();

            // Confirm the expense is on this trip before serving (defense in depth; the role filter
            // already scopes to the trip).
            var exists = await db.Expenses.AnyAsync(e => e.Id == expenseId && e.TripId == tripId, ct);
            if (!exists)
                return Results.NotFound();

            var receipt = await storage.OpenReceiptAsync(expenseId, ct);
            return receipt is null
                ? Results.NotFound()
                : Results.Stream(receipt.Content, receipt.ContentType);
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.AiReceiptScanning))
        .AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound);

        // Remove the receipt. Editor+.
        group.MapDelete("/{expenseId:guid}/receipt", async (
            Guid tripId, Guid expenseId, [FromServices] IReceiptStorage? storage, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == expenseId && e.TripId == tripId, ct);
            if (expense is null)
                return Results.NotFound();

            if (storage is not null)
                await storage.DeleteReceiptAsync(expenseId, ct);

            expense.ClearReceipt();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.AiReceiptScanning))
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status404NotFound);

        return group;
    }
}
