using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Budget;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Reservations;

// F23 (option c): a booking's cost is mirrored into the trip budget as a linked Expense, so money
// lives in one place (the Budget module). This keeps that one Expense in step with the reservation.
// Methods only mutate the shared AppDbContext; the calling handler saves once, so the reservation and
// its expense commit in the same transaction. A created expense raises ExpenseAddedDomainEvent (the
// read-model total bumps); updates/removals raise nothing — same as a manual expense edit/delete,
// which the live budget view recomputes from rows anyway.
public class ReservationBudgetSync(AppDbContext db)
{
    public async Task EnsureExpenseAsync(Reservation reservation, CancellationToken ct)
    {
        var existing = await db.Expenses
            .FirstOrDefaultAsync(e => e.ReservationId == reservation.Id, ct);

        // A cancelled booking owes nothing, and a booking with no cost tracks nothing.
        var shouldHaveExpense = reservation.Cost.HasValue && reservation.Status != ReservationStatus.Cancelled;

        if (!shouldHaveExpense)
        {
            if (existing is not null)
            {
                db.Expenses.Remove(existing);
            }
            return;
        }

        var category = MapCategory(reservation.Type);
        var date = DateOnly.FromDateTime(reservation.StartsAt);

        if (existing is null)
        {
            db.Expenses.Add(Expense.Create(
                reservation.TripId, reservation.Title, reservation.Cost!.Value, reservation.Currency,
                category, date, reservation.Id));
        }
        else
        {
            existing.Description = reservation.Title;
            existing.Amount = reservation.Cost!.Value;
            existing.Currency = reservation.Currency;
            existing.Category = category;
            existing.Date = date;
        }
    }

    public async Task RemoveExpenseAsync(Guid reservationId, CancellationToken ct)
    {
        var existing = await db.Expenses.FirstOrDefaultAsync(e => e.ReservationId == reservationId, ct);
        if (existing is not null)
        {
            db.Expenses.Remove(existing);
        }
    }

    private static ExpenseCategory MapCategory(ReservationType type) => type switch
    {
        ReservationType.Flight => ExpenseCategory.Transport,
        ReservationType.CarRental => ExpenseCategory.Transport,
        ReservationType.Transport => ExpenseCategory.Transport,
        ReservationType.Accommodation => ExpenseCategory.Accommodation,
        ReservationType.Restaurant => ExpenseCategory.Food,
        ReservationType.Tour => ExpenseCategory.Activities,
        _ => ExpenseCategory.Other,
    };
}
