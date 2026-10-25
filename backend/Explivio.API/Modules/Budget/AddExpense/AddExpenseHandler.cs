using System.Globalization;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Notifications;
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
            command.Date,
            paidByUserId: command.PaidByUserId,
            shares: command.Splits);

        db.Expenses.Add(expense);

        // F20: notify the trip's other members (published via the outbox in the same transaction).
        var detail = $"{command.Amount.ToString("0.##", CultureInfo.InvariantCulture)} {command.Currency}";
        var notification = await TripNotifications.BuildAsync(
            db, command.TripId, command.ActorUserId, NotificationKind.ExpenseAdded, detail, cancellationToken);
        if (notification is not null) db.OutboxMessages.Add(notification);

        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "expense.created", cancellationToken);

        return expense.Id;
    }
}
