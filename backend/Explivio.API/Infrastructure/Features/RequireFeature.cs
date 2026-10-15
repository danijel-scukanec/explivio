using Microsoft.FeatureManagement;

namespace Explivio.API.Infrastructure.Features;

// F32: an endpoint filter that gates a route behind a feature flag — the same shape as RequireTripRole.
// When the flag is off the endpoint responds 404 (the feature is hidden, so don't advertise that it
// exists). Applied before any role filter so a disabled feature short-circuits regardless of who calls.
public sealed class RequireFeature(string feature) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var featureManager = context.HttpContext.RequestServices.GetRequiredService<IFeatureManager>();

        if (!await featureManager.IsEnabledAsync(feature))
        {
            return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "This feature is not available.");
        }

        return await next(context);
    }
}
