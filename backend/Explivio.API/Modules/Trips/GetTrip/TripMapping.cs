namespace Explivio.API.Modules.Trips.GetTrip;

// F22: maps a Trip aggregate (with its stops loaded) to the API response. The destination string is
// derived from the stops here; the route is returned in full as Stops.
public static class TripMapping
{
    public static TripResponse ToResponse(this Trip trip) => new(
        trip.Id,
        trip.Name,
        trip.DestinationSummary(),
        trip.StartDate,
        trip.EndDate,
        trip.TravelerCount,
        trip.Status,
        trip.HasCoverPhoto,
        trip.BaseCurrency,
        trip.IsPublic,
        trip.ShareToken,
        trip.CreatedAt,
        trip.Stops
            .OrderBy(s => s.Order)
            .Select(s => new TripStopResponse(s.Id, s.Order, s.Place, s.ArriveDate, s.DepartDate, s.Latitude, s.Longitude))
            .ToList());
}
