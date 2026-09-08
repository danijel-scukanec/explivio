using Explivio.API.Modules.Trips;

namespace Explivio.API.Infrastructure.ReadModel;

// F08: the pure projection rules — how each domain event changes a TripSummary. Kept free of EF
// and Service Bus so the arithmetic is unit-testable on its own; the projector handles loading,
// persistence and dedupe around these.
public static class TripSummaryProjection
{
    public static TripSummary Create(TripCreatedDomainEvent e) => new()
    {
        TripId = e.TripId,
        UserId = e.UserId,
        Name = e.Name,
        Destination = e.Destination,
        StartDate = e.StartDate,
        EndDate = e.EndDate,
        TravelerCount = e.TravelerCount,
        ActivityCount = 0,
        TotalSpend = 0m,
        UpdatedAt = DateTime.UtcNow,
    };

    public static void ApplyActivityAdded(TripSummary summary)
    {
        summary.ActivityCount++;
        summary.UpdatedAt = DateTime.UtcNow;
    }

    public static void ApplyActivityRemoved(TripSummary summary)
    {
        summary.ActivityCount = Math.Max(0, summary.ActivityCount - 1);
        summary.UpdatedAt = DateTime.UtcNow;
    }

    public static void ApplyExpenseAdded(TripSummary summary, decimal amount)
    {
        summary.TotalSpend += amount;
        summary.UpdatedAt = DateTime.UtcNow;
    }
}
