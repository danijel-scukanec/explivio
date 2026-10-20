using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;

namespace Explivio.API.Modules.Reservations.CreateReservation;

public class CreateReservationHandler(
    AppDbContext db, ReservationBudgetSync budgetSync, ITripCollaborationNotifier collaboration)
    : IRequestHandler<CreateReservationCommand, Guid>
{
    public async Task<Guid> Handle(CreateReservationCommand command, CancellationToken cancellationToken)
    {
        var reservation = Reservation.Create(
            command.TripId,
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

        db.Reservations.Add(reservation);
        // F23 (option c): create the linked budget expense (if the booking has a cost) in the same
        // transaction as the reservation.
        await budgetSync.EnsureExpenseAsync(reservation, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "reservation.created", cancellationToken);

        return reservation.Id;
    }
}
