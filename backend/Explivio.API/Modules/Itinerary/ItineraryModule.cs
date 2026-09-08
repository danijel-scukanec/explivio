using Explivio.API.Infrastructure.Api;
using Explivio.API.Modules.Itinerary.CreateActivity;
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
        }).Produces<IEnumerable<Activity>>();

        group.MapPost("/", async (Guid tripId, CreateActivityCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId });
            return Results.Created($"/trips/{tripId}/activities/{id}", new CreatedResponse(id));
        }).Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, AppDbContext db) =>
        {
            // F08: load then remove so the aggregate raises ActivityRemovedDomainEvent for the
            // read-model projector (the outbox interceptor captures it in the same transaction).
            var activity = await db.Activities.FirstOrDefaultAsync(a => a.Id == id && a.TripId == tripId);
            if (activity is null)
            {
                return Results.NotFound();
            }

            activity.Remove();
            db.Activities.Remove(activity);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
