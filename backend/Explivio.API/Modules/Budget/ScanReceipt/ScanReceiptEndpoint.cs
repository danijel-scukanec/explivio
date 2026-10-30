using Explivio.API.Infrastructure.Features;
using Explivio.API.Modules.Trips;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Budget.ScanReceipt;

// F17: reads an uploaded receipt image with the vision model and returns a draft expense. Direct
// endpoint (streams the uploaded bytes, no MediatR), mirroring the cover-photo upload style. The
// extraction uses the same IChatClient + structured output as itinerary generation (F12) — the image
// is attached as a DataContent alongside the prompt.
public static class ScanReceiptEndpoint
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly HashSet<string> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    private const string SystemPrompt =
        "You read receipts from images and extract a single expense. Use the TOTAL paid (including tax/tip). " +
        "Make a sensible best guess for any field that is hard to read; never leave one blank.";

    private const string UserPrompt =
        "Extract one expense from this receipt: a short description (the merchant or place name), the total " +
        "amount, the 3-letter ISO 4217 currency code, the best-fitting category, and the date as YYYY-MM-DD.";

    public static RouteGroupBuilder MapScanReceiptEndpoint(this RouteGroupBuilder group)
    {
        // Scan a receipt → draft expense. Editor+ (it leads to an edit), feature-gated, and gated on a
        // real model being configured (the deterministic stub can't do vision).
        group.MapPost("/scan", async (
            Guid tripId, [FromForm] IFormFile file, [FromServices] IChatClient chatClient,
            [FromServices] IConfiguration config, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(config["AI:Endpoint"]))
                return Results.Problem(
                    "Receipt scanning needs a configured AI model.", statusCode: StatusCodes.Status503ServiceUnavailable);

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

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);

            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, SystemPrompt),
                new(ChatRole.User,
                [
                    new TextContent(UserPrompt),
                    new DataContent(ms.ToArray(), file.ContentType),
                ]),
            };

            var response = await chatClient.GetResponseAsync<ExtractedReceipt>(messages, cancellationToken: ct);
            return Results.Ok(response.Result);
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.AiReceiptScanning))
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
        .DisableAntiforgery()
        .Produces<ExtractedReceipt>()
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return group;
    }
}
