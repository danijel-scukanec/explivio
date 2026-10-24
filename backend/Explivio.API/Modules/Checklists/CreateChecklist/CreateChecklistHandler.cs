using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Checklists.CreateChecklist;

public class CreateChecklistHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<CreateChecklistCommand, Guid>
{
    public async Task<Guid> Handle(CreateChecklistCommand command, CancellationToken cancellationToken)
    {
        // New lists append to the end: one past the current highest SortOrder for the trip.
        var nextOrder = await db.Checklists
            .Where(c => c.TripId == command.TripId)
            .Select(c => (int?)c.SortOrder)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        var checklist = Checklist.Create(command.TripId, command.Name, nextOrder);
        db.Checklists.Add(checklist);
        await db.SaveChangesAsync(cancellationToken);

        // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
        await collaboration.TripChangedAsync(command.TripId, "checklist.created", cancellationToken);

        return checklist.Id;
    }
}
