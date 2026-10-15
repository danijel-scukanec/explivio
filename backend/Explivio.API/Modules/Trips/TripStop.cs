namespace Explivio.API.Modules.Trips;

// F22: one stop on a multi-destination trip — a place the traveller visits, in order. A Trip owns an
// ordered list of these (the source of truth for where the trip goes); the single free-text
// "Destination" field it used to have is gone, derived on demand from these stops instead. Not an
// Entity/aggregate of its own: stops are managed only through the Trip aggregate, so they don't raise
// their own domain events.
public class TripStop
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }

    // Zero-based position in the trip's route. Kept contiguous by the Trip aggregate when stops change.
    public int Order { get; set; }

    public string Place { get; set; } = string.Empty;

    // Optional: when the traveller is at this stop, within the trip's overall span.
    public DateOnly? ArriveDate { get; set; }
    public DateOnly? DepartDate { get; set; }

    // Optional coordinates (from the Google Places picker) so the route can be drawn on the map.
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

// F22: the data for one stop as it comes in from a create/update request. Kept free of identity
// (Id/TripId/Order) — the Trip aggregate assigns those — so the same shape serves both the create
// command and the replace-stops command.
public sealed record TripStopInput(
    string Place,
    DateOnly? ArriveDate,
    DateOnly? DepartDate,
    double? Latitude,
    double? Longitude);
