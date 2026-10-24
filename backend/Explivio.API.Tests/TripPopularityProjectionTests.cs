using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Trips;
using Xunit;

namespace Explivio.API.Tests;

// F26: the pure gallery/like read-model projection rules.
public sealed class TripPopularityProjectionTests
{
    private static TripPublishedDomainEvent SamplePublished(Guid? tripId = null) => new(
        TripId: tripId ?? Guid.NewGuid(),
        OwnerUserId: Guid.NewGuid(),
        Name: "Lisbon long weekend",
        Destination: "Lisbon → Sintra",
        StartDate: new DateOnly(2026, 11, 1),
        EndDate: new DateOnly(2026, 11, 4),
        TravelerCount: 2,
        HasCoverPhoto: true);

    [Fact]
    public void Publish_FromNothing_BuildsPublicRowAtZeroLikes()
    {
        var e = SamplePublished();

        var row = TripPopularityProjection.Publish(null, e);

        Assert.Equal(e.TripId, row.TripId);
        Assert.Equal(e.OwnerUserId, row.OwnerUserId);
        Assert.Equal("Lisbon long weekend", row.Name);
        Assert.Equal("Lisbon → Sintra", row.Destination);
        Assert.True(row.IsPublic);
        Assert.True(row.HasCoverPhoto);
        Assert.Equal(0, row.LikeCount);
    }

    [Fact]
    public void Publish_OnExistingRow_KeepsLikeCount_AndRefreshesDetails()
    {
        var e = SamplePublished();
        var existing = TripPopularityProjection.Publish(null, e);
        TripPopularityProjection.ApplyLiked(existing);
        TripPopularityProjection.ApplyLiked(existing); // 2 likes accrued

        TripPopularityProjection.Unpublish(existing);
        var republished = TripPopularityProjection.Publish(existing, e with { Destination = "Porto" });

        Assert.Same(existing, republished);
        Assert.True(republished.IsPublic);
        Assert.Equal("Porto", republished.Destination);
        Assert.Equal(2, republished.LikeCount); // preserved across unpublish → republish
    }

    [Fact]
    public void ApplyUnliked_DecrementsButNeverBelowZero()
    {
        var row = TripPopularityProjection.Publish(null, SamplePublished());

        TripPopularityProjection.ApplyLiked(row);
        TripPopularityProjection.ApplyUnliked(row);
        TripPopularityProjection.ApplyUnliked(row); // already 0 — must not go negative

        Assert.Equal(0, row.LikeCount);
    }

    [Fact]
    public void Unpublish_ClearsPublicFlag_ButLeavesLikes()
    {
        var row = TripPopularityProjection.Publish(null, SamplePublished());
        TripPopularityProjection.ApplyLiked(row);

        TripPopularityProjection.Unpublish(row);

        Assert.False(row.IsPublic);
        Assert.Equal(1, row.LikeCount);
    }
}
