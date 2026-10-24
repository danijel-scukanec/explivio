namespace Explivio.API.Modules.Checklists;

// F24: the read shape for a trip's checklists. Projected from the entities so the API contract is
// explicit (and the client types generate cleanly) rather than leaking EF navigation properties.
public record ChecklistResponse(
    Guid Id,
    Guid TripId,
    string Name,
    int SortOrder,
    DateTime CreatedAt,
    IReadOnlyList<ChecklistItemResponse> Items);

public record ChecklistItemResponse(
    Guid Id,
    Guid ChecklistId,
    string Text,
    bool IsChecked,
    int SortOrder,
    DateTime CreatedAt);
