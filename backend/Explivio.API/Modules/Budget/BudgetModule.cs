using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Budget.AddExpense;
using Explivio.API.Modules.Budget.Export;
using Explivio.API.Modules.Budget.GetBudgetBalances;
using Explivio.API.Modules.Budget.GetBudgetSummary;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Budget;

public static class BudgetModule
{
    public static IEndpointRouteBuilder MapBudgetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/expenses").RequireAuthorization();

        // F25: the summary is now a CQRS query — it converts every expense into the trip's base
        // currency via live (cached) FX rates, rather than summing raw amounts across currencies.
        group.MapGet("/", async (Guid tripId, IMediator mediator) =>
        {
            var summary = await mediator.Send(new GetBudgetSummaryQuery(tripId));
            return Results.Ok(summary);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<BudgetSummaryResponse>();

        // F25: who owes whom across the trip's split expenses, with a suggested settle-up.
        group.MapGet("/balances", async (Guid tripId, IMediator mediator) =>
        {
            var balances = await mediator.Send(new GetBudgetBalancesQuery(tripId));
            return Results.Ok(balances);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<BudgetBalancesResponse>();

        // F25: download the budget as CSV or PDF. ?format=csv (default) | pdf.
        group.MapGet("/export", async (
            Guid tripId, string? format, IMediator mediator, AppDbContext db,
            IEnumerable<IBudgetExporter> exporters) =>
        {
            var exportFormat = string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase)
                ? ExportFormat.Pdf
                : ExportFormat.Csv;
            var exporter = exporters.First(e => e.Format == exportFormat);

            var tripName = await db.Trips
                .Where(t => t.Id == tripId)
                .Select(t => t.Name)
                .FirstOrDefaultAsync() ?? "Trip";
            var summary = await mediator.Send(new GetBudgetSummaryQuery(tripId));

            var (content, contentType, fileName) = exporter.Export(tripName, summary);
            return Results.File(content, contentType, fileName);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces(StatusCodes.Status200OK);

        group.MapPost("/", async (Guid tripId, AddExpenseCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId });
            return Results.Created($"/trips/{tripId}/expenses/{id}", new CreatedResponse(id));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, AppDbContext db, ITripCollaborationNotifier collaboration) =>
        {
            var deleted = await db.Expenses
                .Where(e => e.Id == id && e.TripId == tripId)
                .ExecuteDeleteAsync();
            if (deleted == 0)
            {
                return Results.NotFound();
            }

            // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
            await collaboration.TripChangedAsync(tripId, "expense.deleted");
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
