using MediatR;

namespace Explivio.API.Modules.Reservations.CreateReservation;

public record CreateReservationCommand(
    Guid TripId,
    ReservationType Type,
    string Title,
    string? Provider,
    string? ConfirmationNumber,
    DateTime StartsAt,
    DateTime? EndsAt,
    ReservationStatus Status,
    string? BookingUrl,
    string? Notes,
    decimal? Cost,
    string Currency
) : IRequest<Guid>;
