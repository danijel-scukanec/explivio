using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Checklists.AddChecklistItem;
using Explivio.API.Modules.Checklists.CreateChecklist;
using Explivio.API.Modules.Checklists.RenameChecklist;
using Explivio.API.Modules.Checklists.UpdateChecklistItem;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Checklists;

public static class ChecklistsModule
{
    public static IEndpointRouteBuilder MapChecklistEndpoints(this IEndpointRouteBuilder app)
    {
        // F24: trip-scoped checklists (packing lists / to-dos). Reads need Viewer, writes need Editor —
        // the same role seam as activities and reservations.
        var group = app.MapGroup("/trips/{tripId:guid}/checklists").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db, CancellationToken ct) =>
        {
            var checklists = await db.Checklists
                .Where(c => c.TripId == tripId)
                .OrderBy(c => c.SortOrder)
                .Select(c => new ChecklistResponse(
                    c.Id, c.TripId, c.Name, c.SortOrder, c.CreatedAt,
                    c.Items
                        .OrderBy(i => i.SortOrder)
                        .Select(i => new ChecklistItemResponse(
                            i.Id, i.ChecklistId, i.Text, i.IsChecked, i.SortOrder, i.CreatedAt))
                        .ToList()))
                .ToListAsync(ct);
            return Results.Ok(checklists);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<IEnumerable<ChecklistResponse>>();

        group.MapPost("/", async (Guid tripId, CreateChecklistCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId });
            return Results.Created($"/trips/{tripId}/checklists/{id}", new CreatedResponse(id));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapPut("/{id:guid}", async (Guid tripId, Guid id, RenameChecklistCommand command, IMediator mediator) =>
        {
            var updated = await mediator.Send(command with { TripId = tripId, Id = id });
            return updated ? Results.NoContent() : Results.NotFound();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (
            Guid tripId, Guid id, AppDbContext db, ITripCollaborationNotifier collaboration, CancellationToken ct) =>
        {
            var checklist = await db.Checklists.FirstOrDefaultAsync(c => c.Id == id && c.TripId == tripId, ct);
            if (checklist is null)
            {
                return Results.NotFound();
            }

            // Items cascade with the list (see ChecklistConfiguration).
            db.Checklists.Remove(checklist);
            await db.SaveChangesAsync(ct);

            await collaboration.TripChangedAsync(tripId, "checklist.deleted", ct);
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        // --- items ---------------------------------------------------------------------------------

        group.MapPost("/{checklistId:guid}/items", async (
            Guid tripId, Guid checklistId, AddChecklistItemCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId, ChecklistId = checklistId });
            return id is null
                ? Results.NotFound()
                : Results.Created($"/trips/{tripId}/checklists/{checklistId}/items/{id}", new CreatedResponse(id.Value));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<CreatedResponse>(StatusCodes.Status201Created)
          .Produces(StatusCodes.Status404NotFound).ProducesValidationProblem();

        group.MapPut("/{checklistId:guid}/items/{id:guid}", async (
            Guid tripId, Guid checklistId, Guid id, UpdateChecklistItemCommand command, IMediator mediator) =>
        {
            var updated = await mediator.Send(command with { TripId = tripId, ChecklistId = checklistId, Id = id });
            return updated ? Results.NoContent() : Results.NotFound();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound).ProducesValidationProblem();

        group.MapDelete("/{checklistId:guid}/items/{id:guid}", async (
            Guid tripId, Guid checklistId, Guid id, AppDbContext db,
            ITripCollaborationNotifier collaboration, CancellationToken ct) =>
        {
            var item = await db.ChecklistItems
                .Where(i => i.Id == id && i.ChecklistId == checklistId)
                .Where(i => db.Checklists.Any(c => c.Id == i.ChecklistId && c.TripId == tripId))
                .FirstOrDefaultAsync(ct);
            if (item is null)
            {
                return Results.NotFound();
            }

            db.ChecklistItems.Remove(item);
            await db.SaveChangesAsync(ct);

            await collaboration.TripChangedAsync(tripId, "checklist.updated", ct);
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
