using Microsoft.AspNetCore.SignalR;

namespace Explivio.API.Modules.Trips.Collaboration;

// F15 Phase B: the write side of real-time collaboration. Mutation handlers depend on this
// abstraction rather than SignalR directly, so they stay testable and free of hub types. The push is
// an immediate in-process broadcast to everyone currently viewing the trip — deliberately NOT routed
// through the outbox, whose 5s poll would make "live" updates lag seconds behind the edit.
public interface ITripCollaborationNotifier
{
    Task TripChangedAsync(Guid tripId, string change, CancellationToken cancellationToken = default);
}

public sealed class TripCollaborationNotifier(IHubContext<TripCollaborationHub> hub) : ITripCollaborationNotifier
{
    public Task TripChangedAsync(Guid tripId, string change, CancellationToken cancellationToken = default) =>
        hub.Clients
            .Group(TripCollaborationHub.GroupFor(tripId))
            .SendAsync("TripChanged", new { tripId, change }, cancellationToken);
}
