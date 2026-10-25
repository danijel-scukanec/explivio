using MediatR;

namespace Explivio.API.Modules.Itinerary.CreateActivity;

public record CreateActivityCommand(
    Guid TripId,
    string Name,
    string? Description,
    string? Location,
    DateOnly Date,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    ActivityCategory Category,
    double? Latitude,
    double? Longitude,
    // F20: the authenticated caller, set by the endpoint. Used to notify the trip's OTHER members and
    // to exclude the actor from their own notification. Defaults to empty for non-endpoint callers.
    Guid ActorUserId = default
) : IRequest<Guid>;
