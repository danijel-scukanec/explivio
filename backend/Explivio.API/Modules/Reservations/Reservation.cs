namespace Explivio.API.Modules.Reservations;

// F23: a booking attached to a trip — a flight, hotel, car hire, restaurant reservation, etc. It is
// deliberately its own entity rather than an itinerary Activity: a booking (a round-trip flight, a
// week-long car hire) is not a single day-activity. It surfaces in the itinerary by its StartsAt date
// but lives in its own list. When Cost is set, a linked budget Expense is kept in sync (see
// ReservationBudgetSync) — that Expense is the single place the money is tracked.
public class Reservation
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public ReservationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Provider { get; set; }
    public string? ConfirmationNumber { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public ReservationStatus Status { get; set; }
    public string? BookingUrl { get; set; }
    public string? Notes { get; set; }
    public decimal? Cost { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime CreatedAt { get; set; }

    public static Reservation Create(
        Guid tripId, ReservationType type, string title, string? provider, string? confirmationNumber,
        DateTime startsAt, DateTime? endsAt, ReservationStatus status, string? bookingUrl, string? notes,
        decimal? cost, string currency)
    {
        return new Reservation
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            Type = type,
            Title = title,
            Provider = provider,
            ConfirmationNumber = confirmationNumber,
            StartsAt = startsAt,
            EndsAt = endsAt,
            Status = status,
            BookingUrl = bookingUrl,
            Notes = notes,
            Cost = cost,
            Currency = currency,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Update(
        ReservationType type, string title, string? provider, string? confirmationNumber,
        DateTime startsAt, DateTime? endsAt, ReservationStatus status, string? bookingUrl, string? notes,
        decimal? cost, string currency)
    {
        Type = type;
        Title = title;
        Provider = provider;
        ConfirmationNumber = confirmationNumber;
        StartsAt = startsAt;
        EndsAt = endsAt;
        Status = status;
        BookingUrl = bookingUrl;
        Notes = notes;
        Cost = cost;
        Currency = currency;
    }
}

public enum ReservationType
{
    Flight,
    Accommodation,
    CarRental,
    Restaurant,
    Transport,
    Tour,
    Other
}

public enum ReservationStatus
{
    Reserved,
    Confirmed,
    Cancelled
}
