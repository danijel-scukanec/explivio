using Explivio.NotificationsWorker.Pushing;
using Xunit;

namespace Explivio.NotificationsWorker.Tests;

// F20 (push): the Kind + Detail → push title/body mapping. Title is the trip name; body mirrors the
// in-app wording and appends the detail when present.
public sealed class PushMessageTextTests
{
    [Theory]
    [InlineData("ActivityAdded", "Added an activity")]
    [InlineData("ActivityRemoved", "Removed an activity")]
    [InlineData("ExpenseAdded", "Added an expense")]
    [InlineData("ExpenseRemoved", "Removed an expense")]
    [InlineData("StatusChanged", "Changed the trip status")]
    public void Maps_each_known_kind_to_its_phrase(string kind, string expected)
    {
        var (title, body) = PushMessageText.For("Lisbon Getaway", kind, null);

        Assert.Equal("Lisbon Getaway", title);
        Assert.Equal(expected, body);
    }

    [Fact]
    public void Appends_detail_when_present()
    {
        var (_, body) = PushMessageText.For("Trip", "ActivityAdded", "Belem Tower");

        Assert.Equal("Added an activity: Belem Tower", body);
    }

    [Fact]
    public void Falls_back_for_unknown_kind_and_empty_trip_name()
    {
        var (title, body) = PushMessageText.For("", "Something", null);

        Assert.Equal("Trip update", title);
        Assert.Equal("Updated the trip", body);
    }
}
