using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips;

// F15: managing who can see and edit a trip. Listing is open to any member; inviting, changing a role
// and removing require Owner (enforced by RequireTripRole). A guard stops the last Owner being removed
// or demoted, so a trip can't be orphaned. Kept as direct-DbContext endpoints, matching the existing
// activity/expense delete endpoints, rather than a full command slice per operation.
public static class TripMembersModule
{
    public static IEndpointRouteBuilder MapTripMembersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trips/{tripId:guid}/members").RequireAuthorization();

        group.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            // F25: include each member's display name + email (left-joined from Users) so the member
            // UI and the budget split UI can show people, not GUIDs. A member without a Users row
            // (e.g. the fake dev user) falls back to nulls.
            var members = await (
                from m in db.TripMembers
                where m.TripId == tripId
                join u in db.Users on m.UserId equals u.Id into users
                from u in users.DefaultIfEmpty()
                orderby m.Role descending
                select new TripMemberResponse(
                    m.UserId,
                    m.Role,
                    u != null ? u.DisplayName : null,
                    u != null ? u.Email : null))
                .ToListAsync();
            return Results.Ok(members);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<IEnumerable<TripMemberResponse>>();

        // F15: the caller's own role on this trip, so the UI can show Owner-only controls. The internal
        // user id isn't in the token, so the client can't derive it from the member list itself.
        group.MapGet("/me", async (Guid tripId, HttpContext ctx, AppDbContext db) =>
        {
            var userId = ctx.GetUserId();
            var role = await db.TripMembers
                .Where(m => m.TripId == tripId && m.UserId == userId)
                .Select(m => (TripRole?)m.Role)
                .FirstOrDefaultAsync();
            return role is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Not a member.")
                : Results.Ok(new CallerRoleResponse(role.Value));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Viewer))
          .Produces<CallerRoleResponse>();

        group.MapPost("/", async (Guid tripId, AddTripMemberRequest request, AppDbContext db) =>
        {
            if (!Enum.IsDefined(request.Role))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Unknown role.");
            }

            var guard = await UpsertMemberAsync(db, tripId, request.UserId, request.Role);
            return guard ?? Results.Ok(await ToMemberResponseAsync(db, request.UserId, request.Role));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner))
          .Produces<TripMemberResponse>()
          .ProducesProblem(StatusCodes.Status400BadRequest);

        // F15: invite someone by email. If the email resolves to an existing account we add them
        // straight away; if it doesn't, we record a PENDING invite (TripInvite) that's claimed into a
        // membership the first time that person signs in. The response says which happened so the UI
        // can refresh the right list.
        group.MapPost("/invite", async (Guid tripId, InviteTripMemberRequest request, HttpContext ctx, AppDbContext db) =>
        {
            if (!Enum.IsDefined(request.Role))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Unknown role.");
            }

            var email = (request.Email ?? string.Empty).Trim();
            if (email.Length == 0)
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Email is required.");
            }

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
            if (user is null)
            {
                // No account yet — create or update a pending invite, claimed on their first sign-in.
                var normalized = email.ToLowerInvariant();
                var existing = await db.TripInvites
                    .FirstOrDefaultAsync(i => i.TripId == tripId && i.NormalizedEmail == normalized);
                if (existing is null)
                {
                    db.TripInvites.Add(TripInvite.Create(tripId, email, request.Role, ctx.GetUserId()));
                }
                else
                {
                    existing.Role = request.Role;
                    existing.Email = email;
                }
                await db.SaveChangesAsync();
                return Results.Ok(new InviteResultResponse(Pending: true, Member: null));
            }

            var guard = await UpsertMemberAsync(db, tripId, user.Id, request.Role);
            return guard ?? Results.Ok(new InviteResultResponse(
                Pending: false, Member: await ToMemberResponseAsync(db, user.Id, request.Role)));
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner))
          .Produces<InviteResultResponse>()
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

        // F15: pending invites (emails with no account yet). Owner-only — they're management info, and
        // only Owners can create or cancel them.
        var invites = app.MapGroup("/trips/{tripId:guid}/invites").RequireAuthorization();

        invites.MapGet("/", async (Guid tripId, AppDbContext db) =>
        {
            var list = await db.TripInvites
                .Where(i => i.TripId == tripId)
                .OrderBy(i => i.CreatedAt)
                .Select(i => new TripInviteResponse(i.Id, i.Email, i.Role, i.CreatedAt))
                .ToListAsync();
            return Results.Ok(list);
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner))
          .Produces<IEnumerable<TripInviteResponse>>();

        invites.MapDelete("/{inviteId:guid}", async (Guid tripId, Guid inviteId, AppDbContext db) =>
        {
            var invite = await db.TripInvites.FirstOrDefaultAsync(i => i.Id == inviteId && i.TripId == tripId);
            if (invite is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Invite not found.");
            }
            db.TripInvites.Remove(invite);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).AddEndpointFilter(new RequireTripRole(TripRole.Owner))
          .Produces(StatusCodes.Status204NoContent)
          .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    // Adds the user as a member or updates their role; blocks demoting the last Owner. Returns null on
    // success, or a Problem result the caller should return.
    private static async Task<IResult?> UpsertMemberAsync(AppDbContext db, Guid tripId, Guid userId, TripRole role)
    {
        var member = await db.TripMembers.FirstOrDefaultAsync(m => m.TripId == tripId && m.UserId == userId);
        if (member is null)
        {
            db.TripMembers.Add(TripMember.Create(tripId, userId, role));
        }
        else
        {
            if (member.Role == TripRole.Owner && role != TripRole.Owner && await IsLastOwnerAsync(db, tripId))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest, title: "A trip must keep at least one owner.");
            }
            member.Role = role;
        }
        await db.SaveChangesAsync();
        return null;
    }

    private static async Task<TripMemberResponse> ToMemberResponseAsync(AppDbContext db, Guid userId, TripRole role)
    {
        var u = await db.Users
            .Where(x => x.Id == userId)
            .Select(x => new { x.DisplayName, x.Email })
            .FirstOrDefaultAsync();
        return new TripMemberResponse(userId, role, u?.DisplayName, u?.Email);
    }

    private static async Task<bool> IsLastOwnerAsync(AppDbContext db, Guid tripId) =>
        await db.TripMembers.CountAsync(m => m.TripId == tripId && m.Role == TripRole.Owner) <= 1;
}

public sealed record TripMemberResponse(Guid UserId, TripRole Role, string? DisplayName, string? Email);

public sealed record CallerRoleResponse(TripRole Role);

public sealed record AddTripMemberRequest(Guid UserId, TripRole Role);

public sealed record InviteTripMemberRequest(string Email, TripRole Role);

// F15: the outcome of an invite — Pending true means an account-less email was recorded as a pending
// invite (Member null); false means an existing account was added (Member populated).
public sealed record InviteResultResponse(bool Pending, TripMemberResponse? Member);

// F15: a pending invite, for the Owner-only pending list.
public sealed record TripInviteResponse(Guid Id, string Email, TripRole Role, DateTime CreatedAt);
