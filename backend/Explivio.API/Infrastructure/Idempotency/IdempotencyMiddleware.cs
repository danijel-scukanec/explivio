using Explivio.API.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.Idempotency;

// F04 (boundary idempotency, HTTP half): makes mutating requests safe to retry. When a request
// carries an "Idempotency-Key" header, the first one reserves the key, runs, and stores its response;
// any retry with the same key replays that stored response without re-running the operation. Idempotency
// deliberately lives here at the boundary, not in the MediatR pipeline (see ARCHITECTURE.md §3).
public sealed class IdempotencyMiddleware(RequestDelegate next, ILogger<IdempotencyMiddleware> logger)
{
    private const string HeaderName = "Idempotency-Key";
    private const string ReplayedHeader = "Idempotency-Replayed";

    public async Task InvokeAsync(HttpContext context)
    {
        // Only mutating requests that opt in via the header are handled; everything else passes through.
        if (!IsMutating(context.Request.Method)
            || !context.Request.Headers.TryGetValue(HeaderName, out var headerValues))
        {
            await next(context);
            return;
        }

        var key = headerValues.ToString();
        var userId = GetUserId(context);
        if (string.IsNullOrWhiteSpace(key) || userId is null)
        {
            // No usable key or no authenticated user to scope it to — treat as a normal request.
            await next(context);
            return;
        }

        var db = context.RequestServices.GetRequiredService<AppDbContext>();

        var existing = await db.IdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Key == key, context.RequestAborted);
        if (existing is not null)
        {
            await HandleExistingAsync(context, existing);
            return;
        }

        // Reserve the key. A concurrent duplicate racing us here will collide on the primary key.
        db.IdempotencyRecords.Add(new IdempotencyRecord
        {
            UserId = userId.Value,
            Key = key,
            CreatedOnUtc = DateTime.UtcNow,
        });

        try
        {
            await db.SaveChangesAsync(context.RequestAborted);
        }
        catch (DbUpdateException)
        {
            // Another request reserved (or completed) the same key first.
            var concurrent = await db.IdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.UserId == userId && r.Key == key, context.RequestAborted);
            if (concurrent is not null)
            {
                await HandleExistingAsync(context, concurrent);
                return;
            }

            await WriteInProgressAsync(context);
            return;
        }

        await ExecuteAndCaptureAsync(context, db, userId.Value, key);
    }

    // A record already exists: replay it if complete, otherwise the original is still in flight.
    private async Task HandleExistingAsync(HttpContext context, IdempotencyRecord record)
    {
        if (record.CompletedOnUtc is null)
        {
            await WriteInProgressAsync(context);
            return;
        }

        logger.LogInformation("Replaying idempotent response for key {Key}.", record.Key);
        context.Response.StatusCode = record.StatusCode ?? StatusCodes.Status200OK;
        if (!string.IsNullOrEmpty(record.ContentType))
        {
            context.Response.ContentType = record.ContentType;
        }
        context.Response.Headers[ReplayedHeader] = "true";

        if (record.Body is { Length: > 0 })
        {
            context.Response.ContentLength = record.Body.Length;
            await context.Response.Body.WriteAsync(record.Body, context.RequestAborted);
        }
    }

    // Run the endpoint with the response buffered so the result can be stored, then flush it out.
    private async Task ExecuteAndCaptureAsync(HttpContext context, AppDbContext db, Guid userId, string key)
    {
        var originalBody = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next(context);
        }
        finally
        {
            context.Response.Body = originalBody;
        }

        var bytes = buffer.ToArray();
        var status = context.Response.StatusCode;
        var record = await db.IdempotencyRecords
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Key == key, context.RequestAborted);

        if (status >= StatusCodes.Status500InternalServerError)
        {
            // Don't cache server errors — release the reservation so the client can retry cleanly.
            if (record is not null)
            {
                db.IdempotencyRecords.Remove(record);
                await db.SaveChangesAsync(context.RequestAborted);
            }
        }
        else if (record is not null)
        {
            record.StatusCode = status;
            record.ContentType = context.Response.ContentType;
            record.Body = bytes;
            record.CompletedOnUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(context.RequestAborted);
        }

        if (bytes.Length > 0)
        {
            await context.Response.Body.WriteAsync(bytes, context.RequestAborted);
        }
    }

    private static async Task WriteInProgressAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status409Conflict;
        var problemDetails = context.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails =
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Request in progress",
                Detail = "A request with this Idempotency-Key is already being processed.",
            },
        });
    }

    private static bool IsMutating(string method) =>
        HttpMethods.IsPost(method)
        || HttpMethods.IsPut(method)
        || HttpMethods.IsPatch(method)
        || HttpMethods.IsDelete(method);

    private static Guid? GetUserId(HttpContext context) =>
        Guid.TryParse(context.User.FindFirst("sub")?.Value, out var id) ? id : null;
}

public static class IdempotencyMiddlewareExtensions
{
    public static IApplicationBuilder UseIdempotency(this IApplicationBuilder app) =>
        app.UseMiddleware<IdempotencyMiddleware>();
}
