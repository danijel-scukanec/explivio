using System.Globalization;
using System.Text;

namespace Explivio.API.Modules.Budget.Export;

// F25: CSV export — hand-written (no dependency). One row per expense plus a totals block. Amounts
// are written with invariant formatting so the file parses the same everywhere.
public sealed class CsvBudgetExporter : IBudgetExporter
{
    public ExportFormat Format => ExportFormat.Csv;

    public (byte[] Content, string ContentType, string FileName) Export(string tripName, BudgetSummaryResponse summary)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Date,Description,Category,Amount,Currency,AmountInBase,BaseCurrency");

        foreach (var e in summary.Expenses)
        {
            sb.Append(e.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append(',')
              .Append(Escape(e.Description)).Append(',')
              .Append(e.Category).Append(',')
              .Append(e.Amount.ToString(CultureInfo.InvariantCulture)).Append(',')
              .Append(e.Currency).Append(',')
              .Append(e.AmountInBase?.ToString(CultureInfo.InvariantCulture) ?? string.Empty).Append(',')
              .Append(summary.BaseCurrency)
              .Append('\n');
        }

        sb.Append('\n');
        sb.Append("Total,,,,," )
          .Append(summary.Total.ToString(CultureInfo.InvariantCulture)).Append(',')
          .Append(summary.BaseCurrency).Append('\n');

        var fileName = $"{Slug(tripName)}-budget.csv";
        return (Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", fileName);
    }

    // RFC 4180: quote fields containing a comma, quote or newline, doubling embedded quotes.
    private static string Escape(string field)
    {
        if (field.Contains(',') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
            return $"\"{field.Replace("\"", "\"\"")}\"";
        return field;
    }

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
