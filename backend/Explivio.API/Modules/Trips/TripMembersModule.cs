using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips;

// F15: managing who can see and edit a trip. Listing is open to any member; adding, changing a role
// and removing require Owner (enforced by RequireTripRole). A guard stops the last Owner being
// removed or demoted, so a trip can't be orphaned. Kept as direct-DbContext endpoints, matching the
// existing activity/expense delete endpoints, rather than a full command slice per operation.
public static class TripMembersModule
{
    public static IEndpointRouteBuilder MapTripMembersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/members").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            // F25: include each member's display name (left-joined from Users) so the budget split UI
            // and the collaboration list can show names, not GUIDs. A member without a Users row
            // (e.g. the fake dev user) falls back to a short id.
            var members = await (
                from m in db.TripMembers
                where m.TripId == tripId
                join u in db.Users on m.UserId equals u.Id into users
                from u in users.DefaultIfEmpty()
                orderby m.Role descending
                select new TripMemberResponse(
                    m.UserId,
                    m.Role,
                    u != null ? u.DisplayName : null))
                .ToListAsync();
            return Results.Ok(members);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<IEnumerable<TripMemberResponse>>();

        group.MapPost("/", async (Guid tripId, AddTripMemberRequest request, AppDbContext db) =>
        {
            if (!Enum.IsDefined(request.Role))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Unknown role.");
            }

            var member = await db.TripMembers
                .FirstOrDefaultAsync(m => m.TripId == tripId && m.UserId == request.UserId);

            if (member is null)
            {
                db.TripMembers.Add(TripMember.Create(tripId, request.UserId, request.Role));
            }
            else
            {
                // Demoting the last Owner would orphan the trip.
                if (member.Role == TripRole.Owner && request.Role != TripRole.Owner
                    && await IsLastOwnerAsync(db, tripId))
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status400BadRequest, title: "A trip must keep at least one owner.");
                }

                member.Role = request.Role;
            }

            await db.SaveChangesAsync();
            var displayName = await db.Users
                .Where(u => u.Id == request.UserId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync();
            return Results.Ok(new TripMemberResponse(request.UserId, request.Role, displayName));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner))
          .Produces<TripMemberResponse>()
          .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapDelete("/{userId:guid}", async (Guid tripId, Guid userId, AppDbContext db) =>
        {
            var member = await db.TripMembers
                .FirstOrDefaultAsync(m => m.TripId == tripId && m.UserId == userId);

            if (member is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Member not found.");
            }

            if (member.Role == TripRole.Owner && await IsLastOwnerAsync(db, tripId))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest, title: "A trip must keep at least one owner.");
            }

            db.TripMembers.Remove(member);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner))
          .Produces(StatusCodes.Status204NoContent)
          .ProducesProblem(StatusCodes.Status400BadRequest)
          .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<bool> IsLastOwnerAsync(AppDbContext db, Guid tripId) =>
        await db.TripMembers.CountAsync(m => m.TripId == tripId && m.Role == TripRole.Owner) <= 1;
}

public sealed record TripMemberResponse(Guid UserId, TripRole Role, string? DisplayName);

public sealed record AddTripMemberRequest(Guid UserId, TripRole Role);
