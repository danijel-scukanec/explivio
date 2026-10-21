namespace Explivio.API.Modules.Budget.Export;

public enum ExportFormat
{
    Csv,
    Pdf
}

// F25: renders a budget summary to a downloadable file. One method per implementation keeps each
// writer small and unit-testable; the endpoint picks the writer by format.
public interface IBudgetExporter
{
    ExportFormat Format { get; }

    // Returns the file bytes plus the content type and a suggested file name for Content-Disposition.
    (byte[] Content, string ContentType, string FileName) Export(string tripName, BudgetSummaryResponse summary);
}
