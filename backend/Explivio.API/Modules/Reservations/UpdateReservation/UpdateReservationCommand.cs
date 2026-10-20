using MediatR;

namespace Explivio.API.Modules.Reservations.UpdateReservation;

public record UpdateReservationCommand(
    Guid TripId,
    Guid Id,
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
) : IRequest<bool>;
