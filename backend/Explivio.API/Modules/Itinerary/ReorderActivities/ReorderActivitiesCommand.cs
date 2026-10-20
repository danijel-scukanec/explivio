using MediatR;

namespace Explivio.API.Modules.Itinerary.ReorderActivities;

// F23: the ordered activity ids for a single day. The handler rewrites each activity's SortOrder to
// its index in this list. TripId comes from the route.
public record ReorderActivitiesCommand(
    Guid TripId,
    IReadOnlyList<Guid> OrderedActivityIds
) : IRequest;
