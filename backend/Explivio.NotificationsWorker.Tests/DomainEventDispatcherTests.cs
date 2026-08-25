using System.Text.Json;
using Explivio.NotificationsWorker.Consuming;
using Explivio.NotificationsWorker.Consuming.Contracts;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Explivio.NotificationsWorker.Tests;

public sealed class DomainEventDispatcherTests
{
    private readonly DomainEventDispatcher dispatcher = new(NullLogger<DomainEventDispatcher>.Instance);

    [Fact]
    public void Dispatch_TripCreated_IsHandled()
    {
        var payload = new TripCreatedDomainEvent(Guid.NewGuid(), "Kyoto", Guid.NewGuid());
        var body = BinaryData.FromString(JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

        var handled = dispatcher.Dispatch(nameof(TripCreatedDomainEvent), body);

        Assert.True(handled);
    }

    [Fact]
    public void Dispatch_UnknownSubject_IsIgnored()
    {
        var handled = dispatcher.Dispatch("SomethingElseDomainEvent", BinaryData.FromString("{}"));

        Assert.False(handled);
    }
}
