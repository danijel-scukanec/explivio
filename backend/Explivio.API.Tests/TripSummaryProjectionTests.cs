using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Trips;
using Xunit;

namespace Explivio.API.Tests;

public sealed class TripSummaryProjectionTests
{
    private static TripCreatedDomainEvent SampleCreated() => new(
        TripId: Guid.NewGuid(),
        Name: "Summer trip",
        Destination: "Zagreb",
        StartDate: new DateOnly(2026, 9, 1),
        EndDate: new DateOnly(2026, 9, 5),
        TravelerCount: 2,
        UserId: Guid.NewGuid());

    [Fact]
    public void Create_MapsTripFields_AndStartsAtZero()
    {
        var e = SampleCreated();

        var summary = TripSummaryProjection.Create(e);

        Assert.Equal(e.TripId, summary.TripId);
        Assert.Equal(e.UserId, summary.UserId);
        Assert.Equal("Summer trip", summary.Name);
        Assert.Equal("Zagreb", summary.Destination);
        Assert.Equal(e.StartDate, summary.StartDate);
        Assert.Equal(e.EndDate, summary.EndDate);
        Assert.Equal(2, summary.TravelerCount);
        Assert.Equal(0, summary.ActivityCount);
        Assert.Equal(0m, summary.TotalSpend);
    }

    [Fact]
    public void ApplyActivityAdded_IncrementsCount()
    {
        var summary = TripSummaryProjection.Create(SampleCreated());

        TripSummaryProjection.ApplyActivityAdded(summary);
        TripSummaryProjection.ApplyActivityAdded(summary);

        Assert.Equal(2, summary.ActivityCount);
    }

    [Fact]
    public void ApplyActivityRemoved_DecrementsButNeverBelowZero()
    {
        var summary = TripSummaryProjection.Create(SampleCreated());
        TripSummaryProjection.ApplyActivityAdded(summary);

        TripSummaryProjection.ApplyActivityRemoved(summary);
        TripSummaryProjection.ApplyActivityRemoved(summary); // already 0 — must not go negative

        Assert.Equal(0, summary.ActivityCount);
    }

    [Fact]
    public void ApplyExpenseAdded_AccumulatesAmount()
    {
        var summary = TripSummaryProjection.Create(SampleCreated());

        TripSummaryProjection.ApplyExpenseAdded(summary, 120.50m);
        TripSummaryProjection.ApplyExpenseAdded(summary, 9.50m);

        Assert.Equal(130.00m, summary.TotalSpend);
    }
}
