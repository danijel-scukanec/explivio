using System.Globalization;
using System.Text;

namespace Explivio.API.Modules.Calendar.Export;

// F27: hand-written RFC 5545 (iCalendar) writer — no dependency, the format is plain text. Each event
// becomes a VEVENT. The same output serves a one-time .ics download and the subscription feed that
// Google/Outlook poll, so UIDs are stable (derived from the entity id) and re-importing updates the
// existing event rather than duplicating it.
//
// Times are written as *floating* local time (no "Z", no TZID): a 10:00 activity shows as 10:00 in
// the traveller's calendar wherever they are. The app has no per-activity timezone, so floating is
// the honest choice — anchoring everything to UTC would shift times for anyone not on UTC.
public sealed class IcsItineraryExporter : IItineraryExporter
{
    public ItineraryExportFormat Format => ItineraryExportFormat.Ics;

    public (byte[] Content, string ContentType, string FileName) Export(ItineraryDocument document)
    {
        var sb = new StringBuilder();
        Line(sb, "BEGIN:VCALENDAR");
        Line(sb, "VERSION:2.0");
        Line(sb, "PRODID:-//Explivio//Trip Planner//EN");
        Line(sb, "CALSCALE:GREGORIAN");
        Line(sb, "METHOD:PUBLISH");
        Line(sb, $"X-WR-CALNAME:{Escape(document.TripName)}");

        var stamp = DateTime.UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        foreach (var e in document.Events)
        {
            Line(sb, "BEGIN:VEVENT");
            Line(sb, $"UID:{e.Uid}@explivio");
            Line(sb, $"DTSTAMP:{stamp}");

            if (e.AllDay || e.Start is null)
            {
                // All-day event: DTEND is exclusive, so it's the day after.
                Line(sb, $"DTSTART;VALUE=DATE:{e.Date:yyyyMMdd}");
                Line(sb, $"DTEND;VALUE=DATE:{e.Date.AddDays(1):yyyyMMdd}");
            }
            else
            {
                Line(sb, $"DTSTART:{Local(e.Start.Value)}");
                Line(sb, $"DTEND:{Local(e.End ?? e.Start.Value)}");
            }

            Line(sb, $"SUMMARY:{Escape(e.Summary)}");
            if (!string.IsNullOrWhiteSpace(e.Description))
                Line(sb, $"DESCRIPTION:{Escape(e.Description)}");
            if (!string.IsNullOrWhiteSpace(e.Location))
                Line(sb, $"LOCATION:{Escape(e.Location)}");
            if (e.Latitude is { } lat && e.Longitude is { } lng)
                Line(sb, $"GEO:{lat.ToString("0.######", CultureInfo.InvariantCulture)};{lng.ToString("0.######", CultureInfo.InvariantCulture)}");
            Line(sb, "END:VEVENT");
        }

        Line(sb, "END:VCALENDAR");

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"{Slug(document.TripName)}-itinerary.ics";
        return (bytes, "text/calendar; charset=utf-8", fileName);
    }

    private static string Local(DateTime value) =>
        value.ToString("yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture);

    // RFC 5545 §3.1: lines are delimited by CRLF and folded at 75 octets (a CRLF followed by a space
    // continues the line). Folding by character is a safe approximation here — all our content is
    // ASCII-ish and well under pathological lengths.
    private static void Line(StringBuilder sb, string content)
    {
        const int max = 75;
        if (content.Length <= max)
        {
            sb.Append(content).Append("\r\n");
            return;
        }

        sb.Append(content, 0, max).Append("\r\n");
        var index = max;
        while (index < content.Length)
        {
            var take = Math.Min(max - 1, content.Length - index);
            sb.Append(' ').Append(content, index, take).Append("\r\n");
            index += take;
        }
    }

    // RFC 5545 §3.3.11: escape backslash, semicolon, comma and newlines in TEXT values.
    private static string Escape(string value) => value
        .Replace("\\", "\\\\")
        .Replace(";", "\\;")
        .Replace(",", "\\,")
        .Replace("\r\n", "\\n")
        .Replace("\n", "\\n")
        .Replace("\r", "\\n");

    private static string Slug(string value)
    {
        var chars = value.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray();
        var slug = new string(chars).Trim('-');
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        return string.IsNullOrEmpty(slug) ? "trip" : slug;
    }
}
