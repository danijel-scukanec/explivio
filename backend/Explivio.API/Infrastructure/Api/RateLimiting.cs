using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Explivio.API.Infrastructure.Api;

// F09: per-caller rate limiting. A global sliding-window limiter partitioned by the
// authenticated user ('sub'), falling back to client IP for anonymous callers, so one
// noisy caller can't exhaust capacity for everyone else. Rejections reuse the F03
// ProblemDetails format (429 + Retry-After) for a consistent error contract.
public static class RateLimiting
{
    public static IServiceCollection AddExplivioRateLimiter(
        this IServiceCollection services, IConfiguration configuration)
    {
        const int segmentsPerWindow = 6;
        var permitLimit = configuration.GetValue<int?>("RateLimiting:PermitLimit") ?? 100;
        var windowSeconds = configuration.GetValue<int?>("RateLimiting:WindowSeconds") ?? 60;

        // Soonest a permit can free in a sliding window: when the oldest segment rolls off.
        var fallbackRetryAfter = Math.Max(1, windowSeconds / segmentsPerWindow);

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                // Infra/metadata endpoints (health probes, OpenAPI) must never be throttled.
                if (context.Request.Path.StartsWithSegments("/health")
                    || context.Request.Path.StartsWithSegments("/alive")
                    || context.Request.Path.StartsWithSegments("/openapi"))
                {
                    return RateLimitPartition.GetNoLimiter("infra");
                }

                var partitionKey =
                    context.User.FindFirst("sub")?.Value
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "anonymous";

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ =>
                    new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = permitLimit,
                        Window = TimeSpan.FromSeconds(windowSeconds),
                        SegmentsPerWindow = segmentsPerWindow,
                        QueueLimit = 0,
                    });
            });

            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                var retryAfterSeconds =
                    context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                        ? (int)Math.Ceiling(retryAfter.TotalSeconds)
                        : fallbackRetryAfter;
                context.HttpContext.Response.Headers.RetryAfter =
                    retryAfterSeconds.ToString(CultureInfo.InvariantCulture);

                var problemDetails = context.HttpContext.RequestServices
                    .GetRequiredService<IProblemDetailsService>();
                await problemDetails.TryWriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails =
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Too many requests",
                        Detail = "Rate limit exceeded. Retry after the period "
                            + "indicated by the Retry-After header.",
                    },
                });
            };
        });
    }
}
