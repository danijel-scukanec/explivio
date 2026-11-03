using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Explivio.API.Infrastructure.AiOps;

// F21: moderates the user's input before it reaches the model. If the last user message is flagged,
// the call short-circuits with a safe refusal instead of a model response — so no unsafe prompt is
// sent on. Added to the pipeline only when moderation is enabled (AiContentSafety flag). Best-effort:
// if the safety check itself errors, the call is allowed through (fail-open, logged).
public sealed class ContentSafetyChatClient(
    IChatClient inner, IContentSafety safety, ILogger<ContentSafetyChatClient> logger) : DelegatingChatClient(inner)
{
    private const string Refusal = "I can't help with that request.";

    public override async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        if (await IsBlockedAsync(messages, cancellationToken))
            return new ChatResponse(new ChatMessage(ChatRole.Assistant, Refusal));
        return await base.GetResponseAsync(messages, options, cancellationToken);
    }

    public override async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (await IsBlockedAsync(messages, cancellationToken))
        {
            yield return new ChatResponseUpdate(ChatRole.Assistant, Refusal);
            yield break;
        }
        await foreach (var update in base.GetStreamingResponseAsync(messages, options, cancellationToken))
            yield return update;
    }

    private async Task<bool> IsBlockedAsync(IEnumerable<ChatMessage> messages, CancellationToken cancellationToken)
    {
        var text = messages.LastOrDefault(m => m.Role == ChatRole.User)?.Text;
        if (string.IsNullOrWhiteSpace(text)) return false;
        try
        {
            var result = await safety.AnalyzeAsync(text, cancellationToken);
            if (result.Blocked)
                logger.LogWarning("Content safety blocked input: {Category} severity {Severity}", result.Category, result.Severity);
            return result.Blocked;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Content safety check failed; allowing the request through.");
            return false;
        }
    }
}
