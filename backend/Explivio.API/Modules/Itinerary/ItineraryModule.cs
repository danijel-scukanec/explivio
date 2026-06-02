using Explivio.API.Modules.Itinerary.CreateActivity;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Explivio.API.Infrastructure.Database;

namespace Explivio.API.Modules.Itinerary;

public static class ItineraryModule
{
    public static IEndpointRouteBuilder MapItineraryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/activities").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            var activities = await db.Activities
                .Where(a => a.TripId == tripId)
                .OrderBy(a => a.Date).ThenBy(a => a.StartTime)
                .ToListAsync();
            return Results.Ok(activities);
        });

        group.MapPost("/", async (Guid tripId, CreateActivityCommand command, IMediator mediator, IValidator<CreateActivityCommand> validator) =>
        {
            var cmd = command with { TripId = tripId };
            var validation = await validator.ValidateAsync(cmd);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var id = await mediator.Send(cmd);
            return Results.Created($"/trips/{tripId}/activities/{id}", new { id });
        });

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, AppDbContext db) =>
        {
            var deleted = await db.Activities
                .Where(a => a.Id == id && a.TripId == tripId)
                .ExecuteDeleteAsync();
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        });

        return app;
    }
}
