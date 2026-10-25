using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Calendar.Export;
using Explivio.API.Modules.Trips;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Calendar;

// F27: export an itinerary (activities + reservations) as a calendar. Two entry points:
//   - an authed, Viewer-gated download of .ics or PDF for a trip you can see;
//   - an anonymous, share-token-addressed .ics *feed* that Google/Outlook subscribe to and poll, so
//     the calendar stays in sync. The token (minted via F26 share links) is the credential — revoking
//     the share link kills the feed.
public static class CalendarModule
{
    public static IEndpointRouteBuilder MapCalendarEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/calendar").RequireAuthorization();

        // Download the itinerary. ?format=ics (default) | pdf.
        group.MapGet("/export", async (
            Guid tripId, string? format, AppDbContext db,
            IEnumerable<IItineraryExporter> exporters, CancellationToken ct) =>
        {
            var document = await TripCalendar.LoadAsync(db, tripId, ct);
            if (document is null) return Results.NotFound();

            var exportFormat = string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase)
                ? ItineraryExportFormat.Pdf
                : ItineraryExportFormat.Ics;
            var exporter = exporters.First(e => e.Format == exportFormat);

            var (content, contentType, fileName) = exporter.Export(document);
            return Results.File(content, contentType, fileName);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status404NotFound);

        return app;
    }

    // F27: the subscription feed. Anonymous by design — external calendar services (Google, Outlook)
    // poll this URL and can't send auth headers, so the unguessable 128-bit share token stands in for
    // a credential. Only ever returns .ics. The literal "calendar" segment doesn't clash with any
    // {guid}/{token} route.
    public static IEndpointRouteBuilder MapCalendarFeedEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/calendar/{token}.ics", async (
            string token, AppDbContext db,
            IEnumerable<IItineraryExporter> exporters, CancellationToken ct) =>
        {
            var tripId = await db.Trips
                .Where(t => t.ShareToken == token)
                .Select(t => (Guid?)t.Id)
                .FirstOrDefaultAsync(ct);
            if (tripId is null) return Results.NotFound();

            var document = await TripCalendar.LoadAsync(db, tripId.Value, ct);
            if (document is null) return Results.NotFound();

            var exporter = exporters.First(e => e.Format == ItineraryExportFormat.Ics);
            var (content, contentType, _) = exporter.Export(document);
            return Results.File(content, contentType);
        }).AllowAnonymous()
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
