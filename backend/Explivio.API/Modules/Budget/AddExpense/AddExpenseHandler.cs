using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;

namespace Explivio.API.Modules.Budget.AddExpense;

public class AddExpenseHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<AddExpenseCommand, Guid>
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

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "expense.created", cancellationToken);

        return expense.Id;
    }
}
