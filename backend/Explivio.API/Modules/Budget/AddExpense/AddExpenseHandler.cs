using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Budget.AddExpense;

public class AddExpenseHandler(AppDbContext db) : IRequestHandler<AddExpenseCommand, Guid>
{
    public async Task<Guid> Handle(AddExpenseCommand command, CancellationToken cancellationToken)
    {
        var expense = Expense.Create(
            command.TripId,
            command.Description,
            command.Amount,
            command.Currency,
            command.Category,
            command.Date);

        db.Expenses.Add(expense);
        await db.SaveChangesAsync(cancellationToken);

        return expense.Id;
    }
}
