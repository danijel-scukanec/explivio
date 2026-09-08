using Explivio.API.Infrastructure.Ai;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Itinerary.GenerateItinerary;
using Xunit;

namespace Explivio.API.Tests;

// F12: exercises the handler against the deterministic fake chat client. This proves the
// structured-output round-trip — prompt in, GeneratedItinerary out — including JSON deserialization
// and enum mapping, with no AI provider, credentials, or network.
public sealed class GenerateItineraryHandlerTests
{
    private static GenerateItineraryCommand SampleCommand() => new(
        TripId: Guid.NewGuid(),
        Prompt: "A relaxed foodie weekend",
        Days: 2,
        Style: "relaxed",
        Budget: "mid-range");

    [Fact]
    public async Task Handle_ReturnsStructuredItinerary_FromChatClient()
    {
        var handler = new GenerateItineraryHandler(new FakeItineraryChatClient());

        var result = await handler.Handle(SampleCommand(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.NotEmpty(result.Summary);
        Assert.Equal(3, result.Activities.Count);
    }

    [Fact]
    public async Task Handle_MapsActivityFields_IncludingEnumCategory()
    {
        var handler = new GenerateItineraryHandler(new FakeItineraryChatClient());

        var result = await handler.Handle(SampleCommand(), CancellationToken.None);

        var first = result.Activities[0];
        Assert.Equal(1, first.Day);
        Assert.Equal("Old town walking tour", first.Name);
        Assert.Equal(ActivityCategory.Sightseeing, first.Category);
        Assert.Equal("09:00", first.SuggestedStartTime);

        // Category is deserialized from a string into the ActivityCategory enum.
        Assert.Contains(result.Activities, a => a.Category == ActivityCategory.Food);
    }
}
