using Microsoft.FeatureManagement;

namespace Explivio.API.Infrastructure.Features;

// F32: exposes the current feature-flag states to the client so the UI can hide features that are
// off (rather than showing a control that 404s). Public (no auth) and unversioned-friendly — it's
// just configuration the client needs to render. Returns a map of flag name -> enabled.
public static class FeaturesModule
{
    public static IEndpointRouteBuilder MapFeaturesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/features", async (IFeatureManager featureManager) =>
        {
            var states = new Dictionary<string, bool>();
            foreach (var flag in FeatureFlags.All)
            {
                states[flag] = await featureManager.IsEnabledAsync(flag);
            }
            return Results.Ok(states);
        })
        .AllowAnonymous()
        .Produces<Dictionary<string, bool>>();

        return app;
    }
}
