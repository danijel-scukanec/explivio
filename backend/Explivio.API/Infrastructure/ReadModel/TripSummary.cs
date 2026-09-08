namespace Explivio.API.Infrastructure.ReadModel;

// F08: the read model for the trip dashboard. A denormalized, per-trip row maintained by the
// projector from domain events, so the dashboard query serves it directly with no joins across
// Trips/Activities/Expenses. Lives in its own "read" schema, separate from the write model.
public sealed class TripSummary
{
    public Guid TripId { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int TravelerCount { get; set; }
    public int ActivityCount { get; set; }

    // Sum of expense amounts. Currency is ignored for now (all amounts summed as one) — a known
    // simplification; multi-currency would need conversion or a per-currency breakdown.
    public decimal TotalSpend { get; set; }

    public DateTime UpdatedAt { get; set; }
}
