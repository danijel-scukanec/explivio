using Explivio.API.Modules.Itinerary.Assistant;
using Microsoft.Extensions.AI;
using Xunit;

namespace Explivio.API.Tests;

// F16: the AI assistant's pure building blocks — the prompt assembly and the editor tool set. The
// model's behaviour and the DB-backed context are proven live; this locks down the deterministic bits.
public sealed class TripAssistantTests
{
    [Fact]
    public void Edit_mode_advertises_the_tools_and_appends_mapped_history()
    {
        var history = new List<ChatTurn>
        {
            new("user", "hello"),
            new("assistant", "hi there"),
        };

        var messages = TripAssistantChat.BuildMessages("TRIP CONTEXT", history, canEdit: true);

        // First two messages are the persona (with edit capabilities) and the trip context.
        Assert.Equal(ChatRole.System, messages[0].Role);
        Assert.Contains("modify the trip", messages[0].Text);
        Assert.Equal(ChatRole.System, messages[1].Role);
        Assert.Equal("TRIP CONTEXT", messages[1].Text);

        // Then the conversation history, mapped to the right roles.
        Assert.Equal(ChatRole.User, messages[2].Role);
        Assert.Equal("hello", messages[2].Text);
        Assert.Equal(ChatRole.Assistant, messages[3].Role);
        Assert.Equal("hi there", messages[3].Text);
    }

    [Fact]
    public void ReadOnly_mode_states_the_viewer_limitation_and_offers_no_edits()
    {
        var messages = TripAssistantChat.BuildMessages("ctx", [], canEdit: false);

        Assert.Contains("read-only", messages[0].Text);
        Assert.DoesNotContain("modify the trip", messages[0].Text);
    }

    [Fact]
    public void BuildMessages_skips_blank_turns()
    {
        var history = new List<ChatTurn> { new("user", "   "), new("user", "real question") };

        var messages = TripAssistantChat.BuildMessages("ctx", history, canEdit: true);

        // 2 system messages + the single non-blank turn.
        Assert.Equal(3, messages.Count);
        Assert.Equal("real question", messages[^1].Text);
    }

    [Fact]
    public void Editor_tool_set_is_the_five_expected_tools()
    {
        // Build only constructs the tool descriptors; mediator/db are invoked only when a tool runs.
        var tools = TripAssistantTools.Build(
            Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 1, 1), "EUR",
            mediator: null!, db: null!, CancellationToken.None);

        var names = tools.Select(t => t.Name).OrderBy(n => n).ToArray();

        Assert.Equal(
            new[] { "add_activity", "add_expense", "delete_activity", "set_trip_status", "update_activity" },
            names);
    }
}
