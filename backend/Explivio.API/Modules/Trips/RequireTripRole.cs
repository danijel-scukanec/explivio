using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips;

// F15: the single place trip-scoped authorization is decided. Applied as an endpoint filter to every
// route under a trip, it looks up the caller's TripMember and checks their role against the minimum
// the operation needs. Not a member → 404 (don't reveal the trip exists); a member but under-
// privileged (e.g. a Viewer trying to edit) → 403. Centralizing it here is also what finally closes
// the pre-F15 gap where the Itinerary and Budget endpoints did no trip-level checking at all.
public sealed class RequireTripRole(TripRole minimum, string routeKey = "tripId") : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;

        if (!Guid.TryParse(http.User.FindFirst("sub")?.Value, out var userId))
        {
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Not authenticated.");
        }

        if (!Guid.TryParse(http.GetRouteValue(routeKey)?.ToString(), out var tripId))
        {
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing trip id.");
        }

        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        var role = await db.TripMembers
            .Where(m => m.TripId == tripId && m.UserId == userId)
            .Select(m => (TripRole?)m.Role)
            .FirstOrDefaultAsync(http.RequestAborted);

        if (role is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Trip not found.");
        }

        if (role < minimum)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: $"This action requires the {minimum} role on the trip.");
        }

        return await next(context);
    }
}
