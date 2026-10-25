namespace Explivio.API.Modules.Calendar.Export;

public enum ItineraryExportFormat
{
    Ics,
    Pdf
}

// F27: renders an itinerary to a downloadable file. Mirrors F25's IBudgetExporter — one writer per
// format, each small and unit-testable; the endpoint resolves them all and picks by format.
public interface IItineraryExporter
{
    ItineraryExportFormat Format { get; }

    // Returns the file bytes plus the content type and a suggested file name for Content-Disposition.
    (byte[] Content, string ContentType, string FileName) Export(ItineraryDocument document);
}
