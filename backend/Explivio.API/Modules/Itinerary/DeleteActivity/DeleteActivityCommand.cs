using System.Text.Json.Serialization;
using MediatR;

namespace Explivio.API.Modules.Itinerary.DeleteActivity;

// F16: the activity delete, extracted from the inline endpoint into a command so the DELETE route and
// the AI assistant's delete_activity tool share one code path (load → raise removal event → notify →
// commit → live-refresh broadcast). Returns false when the activity isn't found under the trip so the
// endpoint can 404. ActorUserId (server-set) is used to notify the trip's other members (F20).
public record DeleteActivityCommand(
    Guid TripId,
    Guid Id,
    [property: JsonIgnore] Guid ActorUserId = default
) : IRequest<bool>;
