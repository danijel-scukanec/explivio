using System.Security.Claims;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.Auth;

// P-Auth: the external -> internal identity seam. Runs once per request, after authentication has
// populated the principal. It reads the provider + subject the token identifies the caller by, maps
// that to the internal User.Id through the UserExternalLogins table (provisioning a user on first sight
// of a new login), and stamps the internal id onto the principal as a private claim that CurrentUser
// reads. Everything downstream — endpoints, the trip-role filter, the collaboration hub — works purely
// in internal ids and never sees a provider detail. Adding "sign in with Google" later is a new
// provider value here, nothing more.
public sealed class CurrentUserResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        var principal = context.User;

        // Only authenticated requests carry an identity to resolve; anonymous/health/OpenAPI requests
        // fall straight through without a database hit.
        if (principal?.Identity?.IsAuthenticated == true
            && TryGetExternalLogin(principal, out var provider, out var subject))
        {
            var userId = await ResolveUserIdAsync(db, provider, subject, principal, context.RequestAborted);
            principal.AddIdentity(new ClaimsIdentity([new Claim(CurrentUser.InternalIdClaim, userId.ToString())]));
        }

        await next(context);
    }

    // The provider is the principal's authentication type ("dev" locally; "entra" once real JWT is
    // wired). The subject is the standard subject claim.
    private static bool TryGetExternalLogin(ClaimsPrincipal principal, out string provider, out string subject)
    {
        provider = principal.Identity?.AuthenticationType ?? ExternalLoginProviders.Entra;
        subject = principal.FindFirst("sub")?.Value
            ?? principal.FindFirst("oid")?.Value
            ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? string.Empty;
        return subject.Length > 0;
    }

    private static async Task<Guid> ResolveUserIdAsync(
        AppDbContext db, string provider, string subject, ClaimsPrincipal principal, CancellationToken ct)
    {
        var existing = await db.UserExternalLogins
            .Where(l => l.Provider == provider && l.Subject == subject)
            .Select(l => l.UserId)
            .FirstOrDefaultAsync(ct);

        if (existing != Guid.Empty)
        {
            return existing;
        }

        // The local "dev" provider issues the internal user id *as* its subject, so a dev subject not in
        // the login table (any impersonated user beyond the seeded default) resolves straight to that id
        // with no provisioning. This preserves the pre-P-Auth "dev sub == internal id" behaviour that
        // local work and the integration tests rely on. Real providers never take this branch.
        if (provider == ExternalLoginProviders.Dev && Guid.TryParse(subject, out var devUserId))
        {
            return devUserId;
        }

        // First time we've seen this external login — provision an internal user for it (JIT). This is
        // the path a brand-new real identity takes on first sign-in.
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = principal.FindFirst("email")?.Value ?? principal.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty,
            DisplayName = principal.FindFirst("name")?.Value ?? principal.FindFirst(ClaimTypes.Name)?.Value ?? "New User",
            CreatedAt = DateTime.UtcNow,
            ExternalLogins =
            {
                new UserExternalLogin
                {
                    Id = Guid.NewGuid(),
                    Provider = provider,
                    Subject = subject,
                    CreatedAt = DateTime.UtcNow,
                },
            },
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return user.Id;
    }
}
