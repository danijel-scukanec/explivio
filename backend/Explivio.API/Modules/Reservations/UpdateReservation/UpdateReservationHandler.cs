using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Reservations.UpdateReservation;

public class UpdateReservationHandler(
    AppDbContext db, ReservationBudgetSync budgetSync, ITripCollaborationNotifier collaboration)
    : IRequestHandler<UpdateReservationCommand, bool>
{
    public async Task<bool> Handle(UpdateReservationCommand command, CancellationToken cancellationToken)
    {
        var reservation = await db.Reservations
            .FirstOrDefaultAsync(r => r.Id == command.Id && r.TripId == command.TripId, cancellationToken);
        if (reservation is null)
        {
            return false;
        }

        reservation.Update(
            command.Type,
            command.Title,
            command.Provider,
            command.ConfirmationNumber,
            command.StartsAt,
            command.EndsAt,
            command.Status,
            command.BookingUrl,
            command.Notes,
            command.Cost,
            command.Currency);

        // F23 (option c): bring the linked budget expense in line with the new cost/status (create,
        // update or remove it) in the same transaction.
        await budgetSync.EnsureExpenseAsync(reservation, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "reservation.updated", cancellationToken);

        return true;
    }
}
