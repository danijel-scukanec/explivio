using MediatR;

namespace Explivio.API.Modules.Trips.CreateTrip;

// F22: a trip is created with an ordered list of stops (multi-destination) rather than a single
// destination string. At least one stop is required (enforced by the validator).
public record CreateTripCommand(
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    IReadOnlyList<TripStopInput> Stops,
    Guid UserId,
    // F25: the currency the trip's budget is reported in (ISO 4217). Optional on the wire; defaults
    // to EUR when the client doesn't send one.
    string BaseCurrency = "EUR"
) : IRequest<Guid>;
