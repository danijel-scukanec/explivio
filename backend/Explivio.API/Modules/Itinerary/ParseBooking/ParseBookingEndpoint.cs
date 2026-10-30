using System.Text;
using System.Text.RegularExpressions;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Modules.Trips;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.ParseBooking;

// F18: reads an uploaded booking confirmation — an email (.eml / text / HTML) or a screenshot — and
// returns draft activities and/or reservations for the user to review and add. Direct endpoint
// (streams the uploaded bytes, no MediatR), mirroring the F17 receipt scan: a text file is decoded and
// sent as text, an image is attached as DataContent for the vision model. Same IChatClient +
// structured output (ExtractedBookings) as the other AI features.
public static partial class ParseBookingEndpoint
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB
    private const int MaxTextChars = 20_000; // enough for a long confirmation; keeps the prompt bounded

    private static readonly HashSet<string> ImageTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    // Emails upload under various types; .eml often arrives as octet-stream.
    private static readonly HashSet<string> TextTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/plain", "text/html", "message/rfc822", "application/octet-stream", "application/eml",
    };

    private const string SystemPrompt =
        "You read a travel booking confirmation (flight, hotel, car hire, restaurant, tour, train, etc.) " +
        "and extract the booking(s) it describes. One message may contain several items — an outbound " +
        "and a return flight, a hotel plus a transfer — so return each separately. For each item decide " +
        "the Kind: a booking that has a provider or confirmation number (flights, hotels, car hire, " +
        "restaurant/tour reservations) is a Reservation; a dated thing to do with no booking record is " +
        "an Activity. Fill only the fields that apply to the chosen kind and leave the rest null. Dates " +
        "are YYYY-MM-DD and times are HH:mm (24-hour). Make a sensible best guess for a field that is " +
        "implied but not explicit; never invent a booking that is not in the text.";

    private const string UserPrompt =
        "Extract the booking(s) from this confirmation.";

    public static IEndpointRouteBuilder MapParseBookingEndpoint(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}").RequireAuthorization();

        group.MapPost("/parse-booking", async (
            Guid tripId, [FromForm] IFormFile file, [FromServices] IChatClient chatClient,
            [FromServices] IConfiguration config, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(config["AI:Endpoint"]))
                return Results.Problem(
                    "Booking parsing needs a configured AI model.", statusCode: StatusCodes.Status503ServiceUnavailable);

            if (file.Length is 0 or > MaxBytes)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = [$"The file must be between 1 byte and {MaxBytes / (1024 * 1024)} MB."],
                });

            var isImage = ImageTypes.Contains(file.ContentType);
            var isText = TextTypes.Contains(file.ContentType);
            if (!isImage && !isText)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = ["Upload a booking email (.eml, .txt, .html) or a screenshot (JPEG, PNG, WebP)."],
                });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var bytes = ms.ToArray();

            var content = new List<AIContent> { new TextContent(UserPrompt) };
            if (isImage)
            {
                content.Add(new DataContent(bytes, file.ContentType));
            }
            else
            {
                var text = Encoding.UTF8.GetString(bytes);
                // Strip HTML to plain-ish text so the model isn't swamped by markup.
                if (string.Equals(file.ContentType, "text/html", StringComparison.OrdinalIgnoreCase))
                    text = HtmlTag().Replace(text, " ");
                if (text.Length > MaxTextChars) text = text[..MaxTextChars];
                content.Add(new TextContent(text));
            }

            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, SystemPrompt),
                new(ChatRole.User, content),
            };

            var response = await chatClient.GetResponseAsync<ExtractedBookings>(messages, cancellationToken: ct);
            return Results.Ok(response.Result);
        })
        .AddEndpointFilter(new RequireFeature(FeatureFlags.AiEmailParsing))
        .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
        .DisableAntiforgery()
        .Produces<ExtractedBookings>()
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex HtmlTag();
}
