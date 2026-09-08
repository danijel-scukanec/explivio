using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Outcomes;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Trips.CreateTrip;
using Explivio.API.Modules.Trips.DeleteTrip;
using Explivio.API.Modules.Trips.GetTrip;
using Explivio.API.Modules.Trips.GetTrips;
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

        // F08: CQRS read side — served straight from the projected TripSummary read model, no joins.
        group.MapGet("/dashboard", async (ReadDbContext read, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var summaries = await read.TripSummaries
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.UpdatedAt)
                .Select(s => new TripSummaryResponse(
                    s.TripId, s.Name, s.Destination, s.StartDate, s.EndDate,
                    s.TravelerCount, s.ActivityCount, s.TotalSpend))
                .ToListAsync();
            return Results.Ok(summaries);
        }).Produces<IEnumerable<TripSummaryResponse>>();

        group.MapGet("/{id:guid}", async (Guid id, IMediator mediator, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var result = await mediator.Send(new GetTripQuery(id, userId));
            return result.ToHttpResult();
        }).Produces<TripResponse>().ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/", async (CreateTripCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command);
            return Results.Created($"/trips/{id}", new CreatedResponse(id));
        }).Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (Guid id, IMediator mediator, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var result = await mediator.Send(new DeleteTripCommand(id, userId));
            return result.ToHttpResult();
        }).Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    private static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException());
}
