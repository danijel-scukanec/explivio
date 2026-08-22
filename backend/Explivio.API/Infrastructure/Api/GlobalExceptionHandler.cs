using Microsoft.AspNetCore.Diagnostics;

namespace Explivio.API.Infrastructure.Api;

/// <summary>
/// Catches anything that escapes an endpoint (bugs, timeouts, the raw
/// <see cref="UnauthorizedAccessException"/> from user-id resolution) and writes a
/// consistent ProblemDetails body instead of a bare 500 or a leaked stack trace.
/// Registered via <c>AddExceptionHandler</c> + <c>UseExceptionHandler</c>.
/// </summary>
public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    IHostEnvironment environment,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, title) = exception switch
        {
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
            logger.LogError(exception, "Unhandled exception");
        else
            logger.LogWarning(exception, "Request rejected: {Message}", exception.Message);

        httpContext.Response.StatusCode = statusCode;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = statusCode,
                Title = title,
                // Never leak internal detail in production; surface it in Development only.
                Detail = environment.IsDevelopment() ? exception.Message : null
            }
        });
    }
}
