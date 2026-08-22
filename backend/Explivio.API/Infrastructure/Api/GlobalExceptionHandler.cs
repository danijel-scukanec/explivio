using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;

namespace Explivio.API.Infrastructure.Api;

/// <summary>
/// Catches anything that escapes an endpoint and writes a consistent ProblemDetails body
/// instead of a bare status code or a leaked stack trace. Maps known cross-cutting
/// exceptions to their proper status: FluentValidation's <see cref="ValidationException"/>
/// (thrown by the validation pipeline behavior) to 400 with per-field errors, and the raw
/// <see cref="UnauthorizedAccessException"/> from user-id resolution to 401.
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
            ValidationException => (StatusCodes.Status400BadRequest, "One or more validation errors occurred."),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
            logger.LogError(exception, "Unhandled exception");
        else
            logger.LogWarning("Request rejected ({StatusCode}): {Message}", statusCode, exception.Message);

        httpContext.Response.StatusCode = statusCode;

        var context = new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = statusCode,
                Title = title,
                // Validation detail is carried in the errors extension below; for a 500 we
                // never leak internal detail in production, only in Development.
                Detail = exception is ValidationException
                    ? null
                    : environment.IsDevelopment() ? exception.Message : null
            }
        };

        if (exception is ValidationException validationException)
        {
            var errors = validationException.Errors
                .GroupBy(failure => failure.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(failure => failure.ErrorMessage).ToArray());

            context.ProblemDetails.Extensions["errors"] = errors;
        }

        return await problemDetailsService.TryWriteAsync(context);
    }
}
