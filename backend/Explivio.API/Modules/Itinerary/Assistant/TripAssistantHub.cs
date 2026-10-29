using System.Runtime.CompilerServices;
using Explivio.API.Infrastructure.Auth;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Modules.Trips;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.FeatureManagement;

namespace Explivio.API.Modules.Itinerary.Assistant;

// F16: the AI trip assistant. A client opens one connection and calls the Chat streaming method with
// the running transcript; the hub grounds the model in the trip, exposes edit tools to Editors, and
// streams the reply token-by-token (same SignalR streaming shape as the F13 generation hub). Tool
// calls dispatch existing commands, so an edit made here fans out via the F15 broadcast and F20
// notifications exactly like a REST edit — the itinerary view refreshes live with no extra wiring.
[Authorize]
public sealed class TripAssistantHub(
    IChatClient chatClient,
    AppDbContext db,
    ITripAssistantContext context,
    IFeatureManager features,
    IMediator mediator) : Hub
{
    public async IAsyncEnumerable<string> Chat(
        TripChatRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        // F32: the hub can't use the RequireFeature endpoint filter, so check the flag here.
        if (!await features.IsEnabledAsync(FeatureFlags.AiAssistant))
        {
            throw new HubException("The assistant is not available.");
        }

        var userId = GetUserId();

        // Member check — mirrors RequireTripRole(Viewer); a non-member gets "not found" rather than a
        // hint the trip exists. The role also decides whether edit tools are offered.
        var role = await db.TripMembers
            .Where(m => m.TripId == request.TripId && m.UserId == userId)
            .Select(m => (TripRole?)m.Role)
            .FirstOrDefaultAsync(cancellationToken);
        if (role is null)
        {
            throw new HubException("Trip not found.");
        }

        var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == request.TripId, cancellationToken);
        if (trip is null)
        {
            throw new HubException("Trip not found.");
        }

        var canEdit = role >= TripRole.Editor;
        var history = request.Messages ?? [];
        var focus = history
            .LastOrDefault(m => string.Equals(m.Role, "user", StringComparison.OrdinalIgnoreCase))?.Content;

        var contextText = await context.BuildAsync(request.TripId, focus, cancellationToken);
        var messages = TripAssistantChat.BuildMessages(contextText, history, canEdit);

        var options = new ChatOptions();
        if (canEdit)
        {
            options.Tools = TripAssistantTools.Build(
                request.TripId, userId, trip.StartDate, trip.BaseCurrency, mediator, db, cancellationToken);
        }

        await foreach (var update in chatClient.GetStreamingResponseAsync(messages, options, cancellationToken))
        {
            if (!string.IsNullOrEmpty(update.Text))
            {
                yield return update.Text;
            }
        }
    }

    private Guid GetUserId() =>
        Context.User.TryGetUserId(out var id) ? id : throw new HubException("Not authenticated.");
}
