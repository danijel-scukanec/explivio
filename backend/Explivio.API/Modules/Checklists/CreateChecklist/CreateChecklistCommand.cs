using MediatR;

namespace Explivio.API.Modules.Checklists.CreateChecklist;

public record CreateChecklistCommand(Guid TripId, string Name) : IRequest<Guid>;
