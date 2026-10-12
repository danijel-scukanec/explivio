namespace Explivio.API.Modules.Trips;

// F15: a user's membership of a trip. A trip has many members; this is what turns a single-owner
// trip into a shared one. Authorization across every trip-scoped operation is decided by looking up
// the caller's TripMember and comparing its Role to what the operation requires.
public sealed class TripMember
{
    public Guid TripId { get; set; }
    public Guid UserId { get; set; }
    public TripRole Role { get; set; }
    public DateTime AddedAt { get; set; }

    public static TripMember Create(Guid tripId, Guid userId, TripRole role) => new()
    {
        TripId = tripId,
        UserId = userId,
        Role = role,
        AddedAt = DateTime.UtcNow,
    };
}
