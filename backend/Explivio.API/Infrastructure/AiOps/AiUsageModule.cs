namespace Explivio.API.Infrastructure.AiOps;

// F21: exposes the accumulated AI usage (tokens, estimated cost, cache hits, per feature + model) for
// an in-app ops view. The same numbers also flow to the Aspire dashboard / Azure Monitor as metrics;
// this endpoint is the quick in-product glance. Authed — it's operational data, not per-user.
public static class AiUsageModule
{
    public static IEndpointRouteBuilder MapAiUsageEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/ai/usage", (IAiUsageTracker tracker) => Results.Ok(tracker.Snapshot()))
            .RequireAuthorization()
            .Produces<AiUsageSnapshot>();

        return app;
    }
}
