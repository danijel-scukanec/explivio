namespace Explivio.API.Modules.Budget;

public record CategoryTotal(string Category, decimal Total);
public record BudgetSummaryResponse(IEnumerable<Expense> Expenses, decimal Total, IEnumerable<CategoryTotal> ByCategory);
