using System.Globalization;
using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Notifications;
using Explivio.API.Modules.Budget.AddExpense;
using Explivio.API.Modules.Budget.Export;
using Explivio.API.Modules.Budget.GetBudgetBalances;
using Explivio.API.Modules.Budget.GetBudgetSummary;
using Explivio.API.Modules.Budget.Receipt;
using Explivio.API.Modules.Budget.ScanReceipt;
using Explivio.API.Infrastructure.Storage;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.AspNetCore.Mvc;
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

        group.MapPost("/", async (Guid tripId, AddExpenseCommand command, HttpContext ctx, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId, ActorUserId = ctx.GetUserId() });
            return Results.Created($"/trips/{tripId}/expenses/{id}", new CreatedResponse(id));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, HttpContext ctx, AppDbContext db, ITripCollaborationNotifier collaboration, [FromServices] IReceiptStorage? receiptStorage, CancellationToken token) =>
        {
            // F20: load then remove (instead of a bulk ExecuteDelete) so the outbox interceptor can
            // capture the member notification raised on the tracked entity in the same transaction.
            var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id && e.TripId == tripId, token);
            if (expense is null)
            {
                return Results.NotFound();
            }

            var detail = $"{expense.Amount.ToString("0.##", CultureInfo.InvariantCulture)} {expense.Currency}";
            var notification = await TripNotifications.BuildAsync(
                db, tripId, ctx.GetUserId(), NotificationKind.ExpenseRemoved, detail, token);
            if (notification is not null) db.OutboxMessages.Add(notification);

            var hadReceipt = expense.HasReceipt;
            db.Expenses.Remove(expense);
            await db.SaveChangesAsync(token);

            // F17: reap the receipt blob best-effort after the row is gone (storage is separate from
            // the DB transaction; a leftover blob is harmless but we clean up).
            if (hadReceipt && receiptStorage is not null)
            {
                try { await receiptStorage.DeleteReceiptAsync(id, token); } catch { /* best-effort */ }
            }

            // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
            await collaboration.TripChangedAsync(tripId, "expense.deleted", token);
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        // F17: receipt scanning (vision → draft) + per-expense receipt image upload/serve/delete.
        group.MapScanReceiptEndpoint();
        group.MapExpenseReceiptEndpoints();

        return app;
    }
}
