using Explivio.API.Modules.Trips;

namespace Explivio.API.Infrastructure.ReadModel;

// F26: the pure projection rules for the gallery/like read model — how each domain event changes a
// TripPopularity row. Kept free of EF and Service Bus so the arithmetic is unit-testable on its own;
// the projector handles loading, persistence and dedupe around these.
public static class TripPopularityProjection
{
    // Published: create the gallery row (event-carried state), or flip an existing one back to public
    // and refresh its details — keeping whatever LikeCount it had accrued.
    public static TripPopularity Publish(TripPopularity? existing, TripPublishedDomainEvent e)
    {
        var row = existing ?? new TripPopularity { TripId = e.TripId, LikeCount = 0 };
        row.OwnerUserId = e.OwnerUserId;
        row.Name = e.Name;
        row.Destination = e.Destination;
        row.StartDate = e.StartDate;
        row.EndDate = e.EndDate;
        row.TravelerCount = e.TravelerCount;
        row.HasCoverPhoto = e.HasCoverPhoto;
        row.IsPublic = true;
        row.UpdatedAt = DateTime.UtcNow;
        return row;
    }

    public static void Unpublish(TripPopularity row)
    {
        row.IsPublic = false;
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static void ApplyLiked(TripPopularity row)
    {
        row.LikeCount++;
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static void ApplyUnliked(TripPopularity row)
    {
        row.LikeCount = Math.Max(0, row.LikeCount - 1);
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static void ApplyStopsChanged(TripPopularity row, string destination)
    {
        row.Destination = destination;
        row.UpdatedAt = DateTime.UtcNow;
    }
}
