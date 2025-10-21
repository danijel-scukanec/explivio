namespace Explivio.Modules.Trips.Presentation.Trips;

public sealed record CreateTripRequest(
    string Title,
    string? Description,
    DateTime StartDate,
    DateTime EndDate);