namespace Explivio.API.Modules.Budget.ScanReceipt;

// F17: the structured expense the vision model reads off a receipt image. A DRAFT — handed to the
// client to pre-fill the add-expense form (like F12's GeneratedItinerary); nothing is persisted until
// the user confirms and the normal AddExpense flow runs. The shape is sent to the model as a JSON
// schema (structured output), so it replies with data in exactly this form, not free text.
public sealed record ExtractedReceipt(
    string Description,
    decimal Amount,
    string Currency,
    ExpenseCategory Category,
    DateOnly Date);
