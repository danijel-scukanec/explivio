using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.Collaboration;

// F15 Phase B: the live collaboration hub. A client opens one connection and calls JoinTrip for the
// trip it is viewing; the hub adds the connection to that trip's group, records presence, and tells
// the group who is here. Content edits arrive separately as "TripChanged" pushes (see
// ITripCollaborationNotifier) and the client refetches. In-process only — Azure SignalR is a later
// scaling swap, at which point presence needs a backplane too.
[Authorize]
public sealed class TripCollaborationHub(AppDbContext db, TripPresence presence) : Hub
{
    public static string GroupFor(Guid tripId) => $"trip-{tripId}";

    public async Task JoinTrip(Guid tripId)
    {
        var userId = GetUserId();

        // Only members may watch a trip — mirrors the RequireTripRole(Viewer) check on the REST reads.
        // A non-member gets the same "not found" shape rather than a hint that the trip exists.
        var isMember = await db.TripMembers.AnyAsync(m => m.TripId == tripId && m.UserId == userId);
        if (!isMember)
        {
            throw new HubException("Trip not found.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(tripId));
        presence.Add(tripId, Context.ConnectionId, userId);
        await BroadcastPresence(tripId);
    }

    public async Task LeaveTrip(Guid tripId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupFor(tripId));
        presence.Remove(tripId, Context.ConnectionId);
        await BroadcastPresence(tripId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // A dropped connection leaves every trip it had joined; tell each remaining group.
        foreach (var tripId in presence.RemoveConnection(Context.ConnectionId))
        {
            await BroadcastPresence(tripId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private Task BroadcastPresence(Guid tripId) =>
        Clients.Group(GroupFor(tripId)).SendAsync("PresenceChanged", new
        {
            tripId,
            userIds = presence.UsersIn(tripId),
        });

    private Guid GetUserId() =>
        Context.User.TryGetUserId(out var id)
            ? id
            : throw new HubException("Not authenticated.");
}
