using System.Security.Claims;

namespace Explivio.API.Infrastructure.Auth;

// Showcase access control. When Auth:AllowedEmails is configured, only authenticated callers whose
// email / username is on the list may use the API; everyone else gets 403. This keeps strangers who
// self-register in Entra from consuming resources (notably the paid AI features) on this public demo.
//
// Fail-open by design: an EMPTY allowlist allows everyone, so local `aspire run` and the integration
// tests (dev identity, which carries no email) are unaffected — the list is only ever set in the
// deployed environment. Anonymous requests (static files, health, OpenAPI, the public gallery and
// shared-link endpoints) are never authenticated, so they pass straight through.
//
// Matching is by the claims the API actually receives on the Entra ACCESS token. Verified: that token
// carries `preferred_username` (the email) and `oid` but NOT `email`, so `preferred_username` is the
// primary match; `email`/`upn` are accepted too for providers that do emit them.
public sealed class AllowlistMiddleware
{
    private static readonly string[] EmailClaims =
        ["preferred_username", "email", "upn", ClaimTypes.Email, ClaimTypes.Upn];

    private readonly RequestDelegate _next;
    private readonly HashSet<string> _allowed;
    private readonly ILogger<AllowlistMiddleware> _logger;

    public AllowlistMiddleware(RequestDelegate next, IConfiguration configuration, ILogger<AllowlistMiddleware> logger)
    {
        _next = next;
        _logger = logger;
        _allowed = (configuration["Auth:AllowedEmails"] ?? string.Empty)
            .Split([',', ';', ' ', '\n', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Nothing to enforce when no allowlist is set, or the caller isn't authenticated (anonymous
        // endpoints, health, OpenAPI, static SPA assets).
        if (_allowed.Count == 0 || context.User.Identity?.IsAuthenticated != true || IsAllowed(context.User))
        {
            await _next(context);
            return;
        }

        var who = context.User.FindFirst("preferred_username")?.Value
            ?? context.User.FindFirst("oid")?.Value
            ?? "unknown";
        _logger.LogWarning("Access denied: {User} is not on Auth:AllowedEmails.", who);

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(
            new
            {
                type = "https://datatracker.ietf.org/doc/html/rfc9457",
                title = "Forbidden",
                status = StatusCodes.Status403Forbidden,
                detail = "This account is not permitted on this instance.",
            });
    }

    private bool IsAllowed(ClaimsPrincipal user)
    {
        foreach (var claim in EmailClaims)
        {
            var value = user.FindFirst(claim)?.Value;
            if (!string.IsNullOrWhiteSpace(value) && _allowed.Contains(value))
            {
                return true;
            }
        }

        return false;
    }
}
