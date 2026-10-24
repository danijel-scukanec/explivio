namespace Explivio.API.Infrastructure.ReadModel;

// F26: the read model behind the public gallery. One denormalized row per trip that has ever been
// published, maintained by the projector from domain events, so the gallery query serves it directly
// (no joins, no scan of the write model). Lives in the "read" schema beside TripSummary. LikeCount is
// kept even while IsPublic is false, so unpublishing then re-publishing restores the count.
public sealed class TripPopularity
{
    public Guid TripId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int TravelerCount { get; set; }
    public bool HasCoverPhoto { get; set; }
    public bool IsPublic { get; set; }
    public int LikeCount { get; set; }
    public DateTime UpdatedAt { get; set; }
}
