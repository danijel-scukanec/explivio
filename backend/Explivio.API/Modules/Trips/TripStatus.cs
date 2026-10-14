namespace Explivio.API.Modules.Trips;

// F22: a trip's lifecycle state. Set explicitly by the user (not derived from dates), so a trip can
// be parked as a Draft or marked Cancelled independently of when it happens. Stored as its name.
public enum TripStatus
{
    Draft,
    Planned,
    Active,
    Completed,
    Cancelled
}
