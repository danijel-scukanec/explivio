using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Checklists.UpdateChecklistItem;

public class UpdateChecklistItemHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<UpdateChecklistItemCommand, bool>
{
    public async Task<bool> Handle(UpdateChecklistItemCommand command, CancellationToken cancellationToken)
    {
        // Join through the parent list so an item can only be touched via its own trip.
        var item = await db.ChecklistItems
            .Where(i => i.Id == command.Id && i.ChecklistId == command.ChecklistId)
            .Where(i => db.Checklists.Any(c => c.Id == i.ChecklistId && c.TripId == command.TripId))
            .FirstOrDefaultAsync(cancellationToken);
        if (item is null)
        {
            return false;
        }

        item.Update(command.Text, command.IsChecked);
        await db.SaveChangesAsync(cancellationToken);

        await collaboration.TripChangedAsync(command.TripId, "checklist.updated", cancellationToken);
        return true;
    }
}
