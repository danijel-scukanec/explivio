using System.Runtime.CompilerServices;
using System.Text;
using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Modules.Trips;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.FeatureManagement;

namespace Explivio.API.Modules.Trips.Recap;

// F29: streams the AI trip recap over SignalR (same shape as the F13 generation and F16 assistant
// hubs) and persists the finished text. The client calls Generate(tripId) and receives the recap
// token-by-token; when the stream completes the hub saves the full narrative as the trip's stored
// recap, so regenerating replaces the keepsake in place.
[Authorize]
public sealed class TripRecapHub(
    IChatClient chatClient,
    AppDbContext db,
    ITripRecapContext context,
    IFeatureManager features,
    IConfiguration configuration) : Hub
{
    public async IAsyncEnumerable<string> Generate(
        Guid tripId,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        // F32: hubs can't use the RequireFeature endpoint filter, so check the flag here.
        if (!await features.IsEnabledAsync(FeatureFlags.AiTripRecap))
        {
            throw new HubException("Trip recap is not available.");
        }

        var userId = GetUserId();

        // Generating writes the stored recap, so require Editor — mirrors RequireTripRole(Editor);
        // a non-member gets "not found" rather than a hint the trip exists.
        var role = await db.TripMembers
            .Where(m => m.TripId == tripId && m.UserId == userId)
            .Select(m => (TripRole?)m.Role)
            .FirstOrDefaultAsync(cancellationToken);
        if (role is null || role < TripRole.Editor)
        {
            throw new HubException("Trip not found.");
        }

        var contextText = await context.BuildAsync(tripId, cancellationToken);
        if (contextText is null)
        {
            throw new HubException("Trip not found.");
        }

        var messages = TripRecapChat.BuildMessages(contextText);

        var full = new StringBuilder();
        await foreach (var update in chatClient.GetStreamingResponseAsync(messages, cancellationToken: cancellationToken))
        {
            if (string.IsNullOrEmpty(update.Text)) continue;
            full.Append(update.Text);
            yield return update.Text;
        }

        // Persist the finished recap (upsert — regenerate replaces in place). Runs after the stream is
        // fully consumed; a cancelled stream leaves the previous recap untouched.
        var content = full.ToString().Trim();
        if (content.Length == 0) yield break;

        var recap = await db.TripRecaps.FirstOrDefaultAsync(r => r.TripId == tripId, cancellationToken);
        if (recap is null)
        {
            recap = new TripRecap { TripId = tripId };
            db.TripRecaps.Add(recap);
        }
        recap.Set(content, configuration["AI:Model"]);
        await db.SaveChangesAsync(cancellationToken);
    }

    private Guid GetUserId() =>
        Context.User.TryGetUserId(out var id) ? id : throw new HubException("Not authenticated.");
}
