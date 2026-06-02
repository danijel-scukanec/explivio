namespace Explivio.API.Modules.Budget;

public class Expense
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public ExpenseCategory Category { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; }
}

public enum ExpenseCategory
{
    Transport,
    Accommodation,
    Food,
    Activities,
    Shopping,
    Other
}
