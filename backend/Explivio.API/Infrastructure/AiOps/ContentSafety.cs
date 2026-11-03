using Azure;
using Azure.AI.ContentSafety;

namespace Explivio.API.Infrastructure.AiOps;

// F21: content moderation for AI inputs. Gated like the other external services — a real Azure AI
// Content Safety client when configured, otherwise a local keyword stand-in so the behaviour is still
// demoable and testable without an Azure resource (the same fake-stub pattern as the chat client).
public interface IContentSafety
{
    Task<ContentSafetyResult> AnalyzeAsync(string text, CancellationToken cancellationToken);
}

// Blocked = at least one category met/exceeded the severity threshold; Category/Severity describe the
// worst hit (for logging).
public sealed record ContentSafetyResult(bool Blocked, string? Category, int Severity)
{
    public static readonly ContentSafetyResult Allowed = new(false, null, 0);
}

// Real moderation via Azure AI Content Safety. Blocks when any harm category's severity reaches the
// configured threshold (Azure returns 0–7; default block at 4 = "medium").
public sealed class AzureContentSafety(ContentSafetyClient client, int threshold) : IContentSafety
{
    public async Task<ContentSafetyResult> AnalyzeAsync(string text, CancellationToken cancellationToken)
    {
        var response = await client.AnalyzeTextAsync(new AnalyzeTextOptions(text), cancellationToken);
        var worst = response.Value.CategoriesAnalysis
            .Where(c => c.Severity is not null)
            .OrderByDescending(c => c.Severity)
            .FirstOrDefault();
        var severity = worst?.Severity ?? 0;
        return severity >= threshold
            ? new ContentSafetyResult(true, worst?.Category.ToString(), severity)
            : ContentSafetyResult.Allowed;
    }
}

// Local stand-in used when Azure Content Safety isn't configured but moderation is enabled. A crude
// keyword blocklist — NOT real safety, just enough to exercise and demo the block path offline. The
// real detector is AzureContentSafety above.
public sealed class KeywordContentSafety : IContentSafety
{
    private static readonly string[] Blocked =
        ["build a bomb", "make a bomb", "how to kill", "hurt myself", "harm myself"];

    public Task<ContentSafetyResult> AnalyzeAsync(string text, CancellationToken cancellationToken)
    {
        var lower = text.ToLowerInvariant();
        var hit = Array.Exists(Blocked, b => lower.Contains(b));
        return Task.FromResult(hit ? new ContentSafetyResult(true, "Harmful (keyword stand-in)", 6) : ContentSafetyResult.Allowed);
    }
}
