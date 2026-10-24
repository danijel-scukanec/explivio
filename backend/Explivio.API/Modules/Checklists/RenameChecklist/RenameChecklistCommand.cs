using MediatR;

namespace Explivio.API.Modules.Checklists.RenameChecklist;

public record RenameChecklistCommand(Guid TripId, Guid Id, string Name) : IRequest<bool>;
