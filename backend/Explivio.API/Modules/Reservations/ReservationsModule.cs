using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Reservations.CreateReservation;
using Explivio.API.Modules.Reservations.UpdateReservation;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Reservations;

public static class ReservationsModule
{
    public static IEndpointRouteBuilder MapReservationEndpoints(this IEndpointRouteBuilder app)
    {
        // F23: trip-scoped bookings — reads need Viewer, writes need Editor (same rule as activities).
        var group = app.MapGroup("/trips/{tripId:guid}/reservations").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            var reservations = await db.Reservations
                .Where(r => r.TripId == tripId)
                .OrderBy(r => r.StartsAt)
                .ToListAsync();
            return Results.Ok(reservations);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<IEnumerable<Reservation>>();

        group.MapPost("/", async (Guid tripId, CreateReservationCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command with { TripId = tripId });
            return Results.Created($"/trips/{tripId}/reservations/{id}", new CreatedResponse(id));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        group.MapPut("/{id:guid}", async (Guid tripId, Guid id, UpdateReservationCommand command, IMediator mediator) =>
        {
            var updated = await mediator.Send(command with { TripId = tripId, Id = id });
            return updated ? Results.NoContent() : Results.NotFound();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound).ProducesValidationProblem();

        group.MapDelete("/{id:guid}", async (
            Guid tripId, Guid id, AppDbContext db, ReservationBudgetSync budgetSync,
            ITripCollaborationNotifier collaboration, CancellationToken ct) =>
        {
            var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id && r.TripId == tripId, ct);
            if (reservation is null)
            {
                return Results.NotFound();
            }

            // F23 (option c): drop the linked budget expense (if any) with the booking, in one transaction.
            await budgetSync.RemoveExpenseAsync(id, ct);
            db.Reservations.Remove(reservation);
            await db.SaveChangesAsync(ct);

            // F15 Phase B: nudge anyone viewing the trip to refetch — immediate, after the commit.
            await collaboration.TripChangedAsync(tripId, "reservation.deleted", ct);
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Editor))
          .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status404NotFound);

        return app;
    }
}
