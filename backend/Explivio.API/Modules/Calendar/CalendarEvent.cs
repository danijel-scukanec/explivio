namespace Explivio.API.Modules.Calendar;

// F27: the normalized shape both exporters (iCalendar + PDF) consume. Activities and reservations
// have different storage shapes (an Activity is a DateOnly + optional TimeOnly, a Reservation is a
// DateTime range); TripCalendar maps both into this one event so the writers stay simple and don't
// need to know where an event came from — beyond Kind, which only drives a label in the PDF.
public sealed record CalendarEvent(
    string Uid,
    string Summary,
    string? Description,
    string? Location,
    DateOnly Date,
    DateTime? Start,
    DateTime? End,
    bool AllDay,
    double? Latitude,
    double? Longitude,
    string Kind);

// F27: a trip's itinerary assembled for export — the trip header plus its events in chronological
// order. Produced by TripCalendar from the trip, its activities and its reservations.
public sealed record ItineraryDocument(
    string TripName,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    IReadOnlyList<CalendarEvent> Events);
