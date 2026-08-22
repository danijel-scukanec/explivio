using System.Diagnostics;
using MediatR;

namespace Explivio.API.Infrastructure.Behaviors;

/// <summary>
/// Wraps every request with structured start/complete logging and timing. Failures are
/// logged at warning level with timing only — the full exception detail is logged once,
/// by the global exception handler, to avoid duplicate stack traces.
/// </summary>
public sealed class LoggingBehavior<TRequest, TResponse>(
    ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        logger.LogDebug("Handling {RequestName}", requestName);

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var response = await next();
            stopwatch.Stop();
            logger.LogInformation(
                "Handled {RequestName} in {ElapsedMilliseconds}ms", requestName, stopwatch.ElapsedMilliseconds);
            return response;
        }
        catch
        {
            stopwatch.Stop();
            logger.LogWarning(
                "{RequestName} failed after {ElapsedMilliseconds}ms", requestName, stopwatch.ElapsedMilliseconds);
            throw;
        }
    }
}
