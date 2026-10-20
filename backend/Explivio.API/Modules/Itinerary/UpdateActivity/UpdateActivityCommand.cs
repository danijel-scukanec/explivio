using MediatR;

namespace Explivio.API.Modules.Itinerary.UpdateActivity;

// F23: TripId and Id come from the route; the rest is the request body. Returns false when the
// activity isn't found under the trip so the endpoint can 404.
public record UpdateActivityCommand(
    Guid TripId,
    Guid Id,
    string Name,
    string? Description,
    string? Location,
    DateOnly Date,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    ActivityCategory Category,
    double? Latitude,
    double? Longitude
) : IRequest<bool>;
