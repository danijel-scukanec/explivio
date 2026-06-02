using Explivio.API.Modules.Trips.CreateTrip;
using Explivio.API.Modules.Trips.DeleteTrip;
using Explivio.API.Modules.Trips.GetTrip;
using Explivio.API.Modules.Trips.GetTrips;
using FluentValidation;
using MediatR;

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
        });

        group.MapGet("/{id:guid}", async (Guid id, IMediator mediator, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var trip = await mediator.Send(new GetTripQuery(id, userId));
            return trip is null ? Results.NotFound() : Results.Ok(trip);
        });

        group.MapPost("/", async (CreateTripCommand command, IMediator mediator, IValidator<CreateTripCommand> validator) =>
        {
            var validation = await validator.ValidateAsync(command);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var id = await mediator.Send(command);
            return Results.Created($"/trips/{id}", new { id });
        });

        group.MapDelete("/{id:guid}", async (Guid id, IMediator mediator, HttpContext ctx) =>
        {
            var userId = ctx.GetUserId();
            var deleted = await mediator.Send(new DeleteTripCommand(id, userId));
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        return app;
    }

    private static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException());
}
