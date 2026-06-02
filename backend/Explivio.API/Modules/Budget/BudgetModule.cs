using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Budget.AddExpense;
using FluentValidation;
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

            var summary = new
            {
                Expenses = expenses,
                Total = expenses.Sum(e => e.Amount),
                ByCategory = expenses.GroupBy(e => e.Category)
                    .Select(g => new { Category = g.Key.ToString(), Total = g.Sum(e => e.Amount) })
            };

            return Results.Ok(summary);
        });

        group.MapPost("/", async (Guid tripId, AddExpenseCommand command, IMediator mediator, IValidator<AddExpenseCommand> validator) =>
        {
            var cmd = command with { TripId = tripId };
            var validation = await validator.ValidateAsync(cmd);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var id = await mediator.Send(cmd);
            return Results.Created($"/trips/{tripId}/expenses/{id}", new { id });
        });

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, AppDbContext db) =>
        {
            var deleted = await db.Expenses
                .Where(e => e.Id == id && e.TripId == tripId)
                .ExecuteDeleteAsync();
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        });

        return app;
    }
}
