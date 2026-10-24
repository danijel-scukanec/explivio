using MediatR;

namespace Explivio.API.Modules.Checklists.AddChecklistItem;

public record AddChecklistItemCommand(Guid TripId, Guid ChecklistId, string Text) : IRequest<Guid?>;
