using System.Text;
using Explivio.API.Modules.Calendar;
using Explivio.API.Modules.Calendar.Export;
using Xunit;

namespace Explivio.API.Tests;

// F27: the itinerary export writers are pure (document in, bytes out), so they're covered as units.
// The ICS writer's output is asserted structurally; the PDF writer is asserted to produce a non-empty
// PDF (layout correctness is a visual concern verified live).
public class ItineraryExportTests
{
    static ItineraryExportTests() =>
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

    private static ItineraryDocument SampleDocument() => new(
        TripName: "Iberian Loop",
        Destination: "Lisbon → Porto",
        StartDate: new DateOnly(2026, 11, 1),
        EndDate: new DateOnly(2026, 11, 3),
        Events:
        [
            new CalendarEvent(
                "activity-1", "Visit Belém Tower", "Historic riverside tower; bring a, comma",
                "Belém, Lisbon", new DateOnly(2026, 11, 1),
                new DateTime(2026, 11, 1, 10, 0, 0), new DateTime(2026, 11, 1, 11, 30, 0),
                AllDay: false, 38.6916, -9.2160, "Sightseeing"),
            new CalendarEvent(
                "activity-2", "Free day", null, null, new DateOnly(2026, 11, 2),
                null, null, AllDay: true, null, null, "Other"),
            new CalendarEvent(
                "reservation-1", "TAP flight LIS→OPO", "TAP · Confirmation ABC123",
                "TAP", new DateOnly(2026, 11, 3),
                new DateTime(2026, 11, 3, 8, 0, 0), new DateTime(2026, 11, 3, 9, 0, 0),
                AllDay: false, null, null, "Flight"),
        ]);

    [Fact]
    public void Ics_export_emits_one_vevent_per_item_with_calendar_wrapper()
    {
        var (content, contentType, fileName) = new IcsItineraryExporter().Export(SampleDocument());
        var text = Encoding.UTF8.GetString(content);

        Assert.StartsWith("text/calendar", contentType);
        Assert.EndsWith(".ics", fileName);
        Assert.Contains("BEGIN:VCALENDAR", text);
        Assert.Contains("END:VCALENDAR", text);
        Assert.Equal(3, Occurrences(text, "BEGIN:VEVENT"));
        Assert.Equal(3, Occurrences(text, "END:VEVENT"));

        // Stable UIDs (so re-import updates rather than duplicates) and CRLF line endings (RFC 5545).
        Assert.Contains("UID:activity-1@explivio", text);
        Assert.Contains("UID:reservation-1@explivio", text);
        Assert.Contains("\r\n", text);
    }

    [Fact]
    public void Ics_export_writes_timed_as_floating_local_and_all_day_as_date()
    {
        var text = Encoding.UTF8.GetString(new IcsItineraryExporter().Export(SampleDocument()).Content);

        // Timed activity: floating local time (no trailing Z, no TZID).
        Assert.Contains("DTSTART:20261101T100000", text);
        Assert.Contains("DTEND:20261101T113000", text);
        Assert.DoesNotContain("DTSTART:20261101T100000Z", text);

        // All-day event: VALUE=DATE with an exclusive next-day DTEND.
        Assert.Contains("DTSTART;VALUE=DATE:20261102", text);
        Assert.Contains("DTEND;VALUE=DATE:20261103", text);

        // GEO is carried when coordinates exist.
        Assert.Contains("GEO:38.6916;-9.216", text);
    }

    [Fact]
    public void Ics_export_escapes_commas_in_text_values()
    {
        var text = Encoding.UTF8.GetString(new IcsItineraryExporter().Export(SampleDocument()).Content);

        // The comma in "bring a, comma" and the one in "Belém, Lisbon" must be backslash-escaped.
        Assert.Contains("bring a\\, comma", text);
        Assert.Contains("LOCATION:Belém\\, Lisbon", text);
    }

    [Fact]
    public void Pdf_export_produces_a_non_empty_pdf()
    {
        var (content, contentType, fileName) = new PdfItineraryExporter().Export(SampleDocument());

        Assert.Equal("application/pdf", contentType);
        Assert.EndsWith(".pdf", fileName);
        Assert.True(content.Length > 0);
        Assert.Equal(0x25, content[0]); // '%' — PDF files start with "%PDF"
    }

    private static int Occurrences(string haystack, string needle)
    {
        var count = 0;
        var i = 0;
        while ((i = haystack.IndexOf(needle, i, StringComparison.Ordinal)) >= 0)
        {
            count++;
            i += needle.Length;
        }
        return count;
    }
}
