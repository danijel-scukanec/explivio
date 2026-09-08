namespace Explivio.API.Infrastructure.ReadModel;

// F08: the dashboard read model as served to clients. A projection of TripSummary — kept separate
// from the storage entity so the read model can evolve without changing the API contract.
public sealed record TripSummaryResponse(
    Guid TripId,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    int ActivityCount,
    decimal TotalSpend);
