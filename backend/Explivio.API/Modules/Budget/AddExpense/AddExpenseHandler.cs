using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Budget.AddExpense;

public class AddExpenseHandler(AppDbContext db) : IRequestHandler<AddExpenseCommand, Guid>
{
    public async Task<Guid> Handle(AddExpenseCommand command, CancellationToken cancellationToken)
    {
        var expense = new Expense
        {
            Id = Guid.NewGuid(),
            TripId = command.TripId,
            Description = command.Description,
            Amount = command.Amount,
            Currency = command.Currency,
            Category = command.Category,
            Date = command.Date,
            CreatedAt = DateTime.UtcNow
        };

        db.Expenses.Add(expense);
        await db.SaveChangesAsync(cancellationToken);

        return expense.Id;
    }
}
