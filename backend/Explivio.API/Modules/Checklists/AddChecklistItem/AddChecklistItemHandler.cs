using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Checklists.AddChecklistItem;

public class AddChecklistItemHandler(AppDbContext db, ITripCollaborationNotifier collaboration)
    : IRequestHandler<AddChecklistItemCommand, Guid?>
{
    // Returns null when the parent list doesn't exist on this trip, so the endpoint can 404.
    public async Task<Guid?> Handle(AddChecklistItemCommand command, CancellationToken cancellationToken)
    {
        var checklist = await db.Checklists
            .FirstOrDefaultAsync(c => c.Id == command.ChecklistId && c.TripId == command.TripId, cancellationToken);
        if (checklist is null)
        {
            return null;
        }

        var nextOrder = await db.ChecklistItems
            .Where(i => i.ChecklistId == command.ChecklistId)
            .Select(i => (int?)i.SortOrder)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        var item = ChecklistItem.Create(command.ChecklistId, command.Text, nextOrder);
        db.ChecklistItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        await collaboration.TripChangedAsync(command.TripId, "checklist.updated", cancellationToken);
        return item.Id;
    }
}
