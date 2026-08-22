using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Budget.AddExpense;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Budget;

public static class BudgetModule
{
    public static IEndpointRouteBuilder MapBudgetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/expenses").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            var expenses = await db.Expenses
                .Where(e => e.TripId == tripId)
                .OrderByDescending(e => e.Date)
                .ToListAsync();

            var summary = new BudgetSummaryResponse(
                Expenses: expenses,
                Total: expenses.Sum(e => e.Amount),
                ByCategory: expenses.GroupBy(e => e.Category)
                    .Select(g => new CategoryTotal(g.Key.ToString(), g.Sum(e => e.Amount)))
            );

            return Results.Ok(summary);
        }).Produces<BudgetSummaryResponse>();

        group.MapPost("/", async (Guid tripId, AddExpenseCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId });
            return Results.Created($"/trips/{tripId}/expenses/{id}", new CreatedResponse(id));
        }).Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, AppDbContext db) =>
        {
            var deleted = await db.Expenses
                .Where(e => e.Id == id && e.TripId == tripId)
                .ExecuteDeleteAsync();
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        }).Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
