namespace Explivio.API.Modules.Budget;

// F25: one expense as returned to clients. AmountInBase is the amount converted into the trip's base
// currency (null when that currency couldn't be converted — e.g. FX unavailable).
public record ExpenseResponse(
    Guid Id,
    Guid TripId,
    string Description,
    decimal Amount,
    string Currency,
    decimal? AmountInBase,
    ExpenseCategory Category,
    DateOnly Date,
    Guid? ReservationId,
    Guid? PaidByUserId,
    IReadOnlyList<ExpenseShareResponse> Shares);

public record ExpenseShareResponse(Guid UserId, decimal Amount);

// F25: category total, in the trip's base currency.
public record CategoryTotal(string Category, decimal Total);

// F25: the original (unconverted) total for one currency — so a mixed-currency trip can still show
// "£120 + €300" alongside the converted grand total.
public record CurrencyTotal(string Currency, decimal Total);

// F25: the budget summary now reports in the trip's base currency. Total and ByCategory are in base
// currency and include only the expenses that could be converted; ByCurrency keeps the originals;
// ConversionAvailable is false when live rates couldn't be fetched (the UI then shows per-currency
// subtotals instead of a single converted total).
public record BudgetSummaryResponse(
    string BaseCurrency,
    bool ConversionAvailable,
    IReadOnlyList<ExpenseResponse> Expenses,
    decimal Total,
    IReadOnlyList<CategoryTotal> ByCategory,
    IReadOnlyList<CurrencyTotal> ByCurrency);
