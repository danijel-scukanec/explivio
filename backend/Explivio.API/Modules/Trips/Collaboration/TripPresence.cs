using System.Collections.Concurrent;

namespace Explivio.API.Modules.Trips.Collaboration;

// F15 Phase B: in-memory registry of who is currently connected to each trip. A process-lifetime
// singleton — presence is ephemeral (it mirrors live SignalR connections), so it is deliberately NOT
// persisted. One user may hold several connections (multiple tabs), so we key by connection id and
// collapse to distinct user ids when reporting. NOTE: this is per API instance; scaling to more than
// one instance needs a backplane (Azure SignalR) for presence to be global — the same scaling swap
// already noted for the hub itself.
public sealed class TripPresence
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, Guid>> _byTrip = new();

    public void Add(Guid tripId, string connectionId, Guid userId)
    {
        var connections = _byTrip.GetOrAdd(tripId, _ => new ConcurrentDictionary<string, Guid>());
        connections[connectionId] = userId;
    }

    public void Remove(Guid tripId, string connectionId)
    {
        if (_byTrip.TryGetValue(tripId, out var connections))
        {
            connections.TryRemove(connectionId, out _);
            if (connections.IsEmpty)
            {
                _byTrip.TryRemove(tripId, out _);
            }
        }
    }

    // Removes a connection from every trip it had joined (used on disconnect). Returns the trips whose
    // presence changed, so the hub can re-broadcast each remaining group.
    public IReadOnlyCollection<Guid> RemoveConnection(string connectionId)
    {
        var affected = new List<Guid>();
        foreach (var (tripId, connections) in _byTrip)
        {
            if (connections.TryRemove(connectionId, out _))
            {
                affected.Add(tripId);
                if (connections.IsEmpty)
                {
                    _byTrip.TryRemove(tripId, out _);
                }
            }
        }

        return affected;
    }

    public IReadOnlyCollection<Guid> UsersIn(Guid tripId) =>
        _byTrip.TryGetValue(tripId, out var connections)
            ? connections.Values.Distinct().ToArray()
            : [];
}
