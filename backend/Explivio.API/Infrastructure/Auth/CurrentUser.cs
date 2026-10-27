using System.Security.Claims;

namespace Explivio.API.Infrastructure.Auth;

// P-Auth: the one place the rest of the app reads "who is calling". It returns the internal User.Id,
// which the CurrentUserResolutionMiddleware has already resolved from the token's external (provider,
// subject) login and stamped onto the principal as a claim. Callers never touch provider claims or the
// external->internal mapping directly — that lives in the middleware, so swapping providers later is a
// change there alone.
public static class CurrentUser
{
    // The claim type carrying the resolved internal user id. Private namespace so it can't collide with
    // provider-issued claims.
    public const string InternalIdClaim = "explivio:uid";

    public static bool TryGetUserId(this ClaimsPrincipal? principal, out Guid userId)
    {
        userId = default;
        var value = principal?.FindFirst(InternalIdClaim)?.Value;
        return value is not null && Guid.TryParse(value, out userId);
    }

    public static bool TryGetUserId(this HttpContext context, out Guid userId) =>
        context.User.TryGetUserId(out userId);

    // Throwing accessor for endpoints that are already behind RequireAuthorization — an unresolved id
    // there means the request slipped through unauthenticated, which is a 401. Mirrors the pre-P-Auth
    // behaviour of the per-module helpers this replaces.
    public static Guid GetUserId(this HttpContext context) =>
        context.TryGetUserId(out var id) ? id : throw new UnauthorizedAccessException();
}
