using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.GetTrip;

// F15: no UserId — access is authorized by RequireTripRole before the handler runs.
public record GetTripQuery(Guid TripId) : IRequest<Result<TripResponse>>;

public record TripResponse(
    Guid Id,
    string Name,
    // F22: a derived "Lisbon → Porto" display summary of the route, for simple list cards. The
    // authoritative route is Stops.
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    TripStatus Status,
    bool HasCoverPhoto,
    // F25: the currency the trip's budget is reported in (ISO 4217).
    string BaseCurrency,
    DateTime CreatedAt,
    IReadOnlyList<TripStopResponse> Stops
);

// F22: one stop on the trip's route.
public record TripStopResponse(
    Guid Id,
    int Order,
    string Place,
    DateOnly? ArriveDate,
    DateOnly? DepartDate,
    double? Latitude,
    double? Longitude
);
