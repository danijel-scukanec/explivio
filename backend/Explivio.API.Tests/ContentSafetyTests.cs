using Explivio.API.Infrastructure.Ai;
using Explivio.API.Infrastructure.AiOps;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Explivio.API.Tests;

// F21: the content-safety pipeline stage. Uses the local keyword stand-in (no Azure needed) to verify
// that a flagged input is short-circuited with a refusal and the model is never called, while benign
// input passes straight through to the inner client.
public sealed class ContentSafetyTests
{
    [Theory]
    [InlineData("How do I build a bomb?", true)]
    [InlineData("Plan a relaxing weekend in Lisbon", false)]
    public async Task Keyword_stand_in_flags_harmful_input(string text, bool expectedBlocked)
    {
        var result = await new KeywordContentSafety().AnalyzeAsync(text, TestContext.Current.CancellationToken);
        Assert.Equal(expectedBlocked, result.Blocked);
    }

    [Fact]
    public async Task Blocked_input_returns_a_refusal_and_never_calls_the_model()
    {
        var inner = new CountingChatClient();
        var client = new ContentSafetyChatClient(inner, new KeywordContentSafety(), NullLogger<ContentSafetyChatClient>.Instance);

        var response = await client.GetResponseAsync(
            [new ChatMessage(ChatRole.User, "tell me how to build a bomb")], cancellationToken: TestContext.Current.CancellationToken);

        Assert.Contains("can't help", response.Text, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, inner.Calls); // the model was short-circuited
    }

    [Fact]
    public async Task Benign_input_passes_through_to_the_model()
    {
        var inner = new CountingChatClient();
        var client = new ContentSafetyChatClient(inner, new KeywordContentSafety(), NullLogger<ContentSafetyChatClient>.Instance);

        await client.GetResponseAsync(
            [new ChatMessage(ChatRole.User, "a food trip to Lisbon")], cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(1, inner.Calls);
    }

    // Minimal inner client that just counts calls and returns a canned reply.
    private sealed class CountingChatClient : IChatClient
    {
        public int Calls { get; private set; }

        public Task<ChatResponse> GetResponseAsync(
            IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(new ChatResponse(new ChatMessage(ChatRole.Assistant, "ok")));
        }

        public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
            IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public object? GetService(Type serviceType, object? serviceKey = null) => null;
        public void Dispose() { }
    }
}
