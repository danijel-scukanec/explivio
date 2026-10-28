using System.Text.Json.Serialization;
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
    // to exclude the actor from their own notification. [JsonIgnore]: server-set from the auth context,
    // so it's never part of the request body (clients can't spoof it) and stays out of the OpenAPI schema.
    [property: JsonIgnore] Guid ActorUserId = default
) : IRequest<Guid>;
