using Explivio.API.Modules.Reservations;

namespace Explivio.API.Modules.Itinerary.ParseBooking;

// F18: the structured result of parsing a booking email/file. The model returns a short summary and a
// list of items it found — one email can hold several (an outbound + return flight, a hotel + a
// transfer). For each item the model decides the Kind: a booking with a provider/confirmation is a
// Reservation (reuses F23), a dated thing-to-do with no booking record is an Activity. It fills the
// fields that apply to the chosen kind and leaves the rest null; the client turns each item into a
// real activity or reservation on "add", so no new persistence lives here.
public sealed record ExtractedBookings(string Summary, IReadOnlyList<ExtractedBookingItem> Items);

public enum ExtractedItemKind
{
    Activity,
    Reservation,
}

public sealed record ExtractedBookingItem(
    ExtractedItemKind Kind,
    string Title,
    string? Description,
    // Start date (YYYY-MM-DD) and time (HH:mm, 24h); apply to both kinds.
    string? Date,
    string? StartTime,
    // End date/time — for multi-day or multi-hour reservations (hotel checkout, flight arrival).
    string? EndDate,
    string? EndTime,
    // Activity-specific.
    ActivityCategory? Category,
    string? Location,
    // Reservation-specific.
    ReservationType? ReservationType,
    string? Provider,
    string? ConfirmationNumber,
    string? BookingUrl,
    decimal? Cost,
    string? Currency);
