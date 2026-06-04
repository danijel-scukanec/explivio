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
    double? Longitude
) : IRequest<Guid>;
