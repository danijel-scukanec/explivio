using MediatR;

namespace Explivio.API.Modules.Checklists.UpdateChecklistItem;

public record UpdateChecklistItemCommand(
    Guid TripId, Guid ChecklistId, Guid Id, string Text, bool IsChecked) : IRequest<bool>;
