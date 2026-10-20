using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Modules.Itinerary.CreateActivity;
using Explivio.API.Modules.Itinerary.GenerateItinerary;
using Explivio.API.Modules.Itinerary.ReorderActivities;
using Explivio.API.Modules.Itinerary.UpdateActivity;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Explivio.API.Infrastructure.Database;

namespace Explivio.API.Modules.Itinerary;

public static class ItineraryModule
{
    public static IEndpointRouteBuilder MapItineraryEndpoints(this IEndpointRouteBuilder app)
    {
        // F15: every activity route is trip-scoped — reads need Viewer, writes need Editor.
        var group = app.MapGroup("/trips/{tripId:guid}/activities").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            // F23: per-day manual order is the sort key; start time is only informational now.
            var activities = await db.Activities
                .Where(a => a.TripId == tripId)
                .OrderBy(a => a.Date).ThenBy(a => a.SortOrder)
                .ToListAsync();
            return Results.Ok(activities);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<IEnumerable<Activity>>();

        group.MapPost("/", async (Guid tripId, CreateActivityCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId });
            return Results.Created($"/trips/{tripId}/activities/{id}", new CreatedResponse(id));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        // F23: edit an activity in place, including its category and booking details.
        group.MapPut("/{id:guid}", async (Guid tripId, Guid id, UpdateActivityCommand command, IMediator mediator) =>
        {
            var updated = await mediator.Send(command with { TripId = tripId, Id = id });
            return updated ? Results.NoContent() : Results.NotFound();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound).ProducesValidationProblem();

        // F23: drag-to-reorder. The client sends a day's activity ids in their new order; the handler
        // rewrites SortOrder to match. Not {id}-scoped, so it sits before the {id:guid} delete below.
        group.MapPut("/reorder", async (Guid tripId, ReorderActivitiesCommand command, IMediator mediator) =>
        {
            await mediator.Send(command with { TripId = tripId });
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).ProducesValidationProblem();

        // F12: AI itinerary generation. Synchronous — the caller waits for the draft. Returns a
        // draft only; the user reviews it and creates activities via POST above. F13 will stream this.
        // F32: gated behind the AiItineraryGeneration feature flag (filter runs before the role check,
        // so a disabled feature 404s regardless of membership).
        group.MapPost("/generate", async (Guid tripId, GenerateItineraryCommand command, IMediator mediator) =>
        {
            var draft = await mediator.Send(command with { TripId = tripId });
            return Results.Ok(draft);
        }).AddEndpointFilter(new RequireFeature(FeatureFlags.AiItineraryGeneration))
          .AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<GeneratedItinerary>().ProducesValidationProblem().ProducesProblem(StatusCodes.Status404NotFound);

        group.MapDelete("/{id:guid}", async (Guid tripId, Guid id, AppDbContext db, ITripCollaborationNotifier collaboration) =>
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

            // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
            await collaboration.TripChangedAsync(tripId, "activity.deleted");
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
