using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Trips.CloneTrip;
using Explivio.API.Modules.Trips.Cover;
using Explivio.API.Modules.Trips.CreateTrip;
using Explivio.API.Modules.Trips.DeleteTrip;
using Explivio.API.Modules.Trips.GetConditions;
using Explivio.API.Modules.Trips.Sharing;
using Explivio.API.Modules.Trips.GetTrip;
using Explivio.API.Modules.Trips.GetTrips;
using Explivio.API.Modules.Trips.SetTripBaseCurrency;
using Explivio.API.Modules.Trips.SetTripStatus;
using Explivio.API.Modules.Trips.SetTripStops;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips;

public static class TripsModule
{
    public static IEndpointRouteBuilder MapTripsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips").RequireAuthorization();

        group.MapGet("/", async (IMediator mediator, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var trips = await mediator.Send(new GetTripsQuery(userId));
            return Results.Ok(trips);
        }).Produces<IEnumerable<TripResponse>>();

        // F08: CQRS read side — served from the projected TripSummary read model.
        // F15: scoped to the trips the caller is a member of (the read model is keyed by owner, so we
        // first resolve the caller's member trip ids from the write model, then filter the summaries).
        group.MapGet("/dashboard", async (ReadDbContext read, AppDbContext db, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var memberTripIds = await db.TripMembers
                .Where(m => m.UserId == userId)
                .Select(m => m.TripId)
                .ToListAsync();

            var summaries = await read.TripSummaries
                .Where(s => memberTripIds.Contains(s.TripId))
                .OrderByDescending(s => s.UpdatedAt)
                .Select(s => new TripSummaryResponse(
                    s.TripId, s.Name, s.Destination, s.StartDate, s.EndDate,
                    s.TravelerCount, s.ActivityCount, s.TotalSpend))
                .ToListAsync();
            return Results.Ok(summaries);
        }).Produces<IEnumerable<TripSummaryResponse>>();

        group.MapGet("/{id:guid}", async (Guid id, IMediator mediator) =>
        {
            var result = await mediator.Send(new GetTripQuery(id));
            return result.ToHttpResult();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer, "id"))
          .Produces<TripResponse>().ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/", async (CreateTripCommand command, IMediator mediator, HttpContext ctx) =>
        {
            // F15: the owner is the authenticated caller, not whatever the body carries.
            var id = await mediator.Send(command with { UserId = ctx.GetUserId() });
            return Results.Created($"/trips/{id}", new CreatedResponse(id));
        }).Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        // F22: change a trip's lifecycle status. Editor+ (changing status is an edit, not ownership).
        group.MapPatch("/{id:guid}/status", async (Guid id, SetTripStatusRequest body, HttpContext ctx, IMediator mediator) =>
        {
            var result = await mediator.Send(new SetTripStatusCommand(id, body.Status, ctx.GetUserId()));
            return result.ToHttpResult();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
          .Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status404NotFound).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (Guid id, IMediator mediator) =>
        {
            var result = await mediator.Send(new DeleteTripCommand(id));
            return result.ToHttpResult();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner, "id"))
          .Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status404NotFound);

        // F25: change the currency the budget is reported in. Editor+ (editing the trip).
        group.MapPatch("/{id:guid}/base-currency", async (Guid id, SetTripBaseCurrencyRequest body, IMediator mediator) =>
        {
            var result = await mediator.Send(new SetTripBaseCurrencyCommand(id, body.BaseCurrency));
            return result.ToHttpResult();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
          .Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status404NotFound).ProducesValidationProblem();

        // F22: replace a trip's ordered stops (multi-destination route). Editor+ (editing the trip).
        group.MapPut("/{id:guid}/stops", async (Guid id, SetTripStopsRequest body, IMediator mediator) =>
        {
            var result = await mediator.Send(new SetTripStopsCommand(id, body.Stops));
            return result.ToHttpResult();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor, "id"))
          .Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status404NotFound).ProducesValidationProblem();

        // F28: destination conditions — per-stop time zone, local currency + live rate, per-day
        // weather. Read-only, so Viewer+ (same gate as the trip read).
        group.MapGet("/{id:guid}/conditions", async (Guid id, IMediator mediator) =>
        {
            var conditions = await mediator.Send(new GetTripConditionsQuery(id));
            return Results.Ok(conditions);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer, "id"))
          .Produces<TripConditionsResponse>();

        // F26: clone a trip as a template. Not RequireTripRole — you can clone any public trip, not
        // just ones you're a member of; the handler does its own "public or member" check.
        group.MapPost("/{id:guid}/clone", async (Guid id, IMediator mediator, HttpContext ctx) =>
        {
            var newId = await mediator.Send(new CloneTripCommand(id, ctx.GetUserId()));
            return newId is null
                ? Results.NotFound()
                : Results.Created($"/trips/{newId}", new CreatedResponse(newId.Value));
        }).Produces<CreatedResponse>(StatusCodes.Status201Created).Produces(StatusCodes.Status404NotFound);

        // F22: trip cover photo upload/serve/delete.
        group.MapTripCoverEndpoints();

        // F26: gallery visibility, share links, and likes.
        group.MapTripSharingEndpoints();

        return app;
    }

    private static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException());
}
