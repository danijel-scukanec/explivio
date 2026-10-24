using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Checklists.RenameChecklist;

public class RenameChecklistHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<RenameChecklistCommand, bool>
{
    public async Task<bool> Handle(RenameChecklistCommand command, CancellationToken cancellationToken)
    {
        var checklist = await db.Checklists
            .FirstOrDefaultAsync(c => c.Id == command.Id && c.TripId == command.TripId, cancellationToken);
        if (checklist is null)
        {
            return false;
        }

        checklist.Rename(command.Name);
        await db.SaveChangesAsync(cancellationToken);

        await collaboration.TripChangedAsync(command.TripId, "checklist.updated", cancellationToken);
        return true;
    }
}
