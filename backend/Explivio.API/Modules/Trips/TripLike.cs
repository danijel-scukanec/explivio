using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F26: one user's like on a trip. An aggregate so it raises the like/unlike domain events that drive
// the gallery read model's like count (through the outbox, exactly like every other projection input).
// Unique per (TripId, UserId) so a user can like a trip at most once.
public class TripLike : Entity
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public static TripLike Create(Guid tripId, Guid userId)
    {
        var like = new TripLike
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
        };
        like.AddDomainEvent(new TripLikedDomainEvent(tripId));
        return like;
    }

    // Raise the unlike event before the row is removed, so the outbox interceptor captures it in the
    // same transaction (mirrors Trip.Delete()).
    public void Unlike() => AddDomainEvent(new TripUnlikedDomainEvent(TripId));
}
