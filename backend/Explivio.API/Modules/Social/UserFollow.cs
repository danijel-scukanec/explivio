namespace Explivio.API.Modules.Social;

// F26 (follow): one directed follow edge — FollowerUserId follows FollowedUserId. A plain entity, NOT an
// event-raising aggregate like TripLike: follower/following counts are cheap COUNT queries and the
// "Following" feed reuses the TripPopularity gallery read model, so there's no denormalized state to keep
// via domain events. Unique per (follower, followed) so following is idempotent at the database.
public class UserFollow
{
    public Guid Id { get; set; }

    // The user doing the following (the caller).
    public Guid FollowerUserId { get; set; }

    // The user being followed.
    public Guid FollowedUserId { get; set; }

    public DateTime CreatedAt { get; set; }
}
