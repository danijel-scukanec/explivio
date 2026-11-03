using System.Net;
using System.Text;
using System.Text.Json;
using Explivio.NotificationsWorker.Pushing;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Explivio.NotificationsWorker.Tests;

// F20 (push): the Expo transport. Verifies it posts the messages and maps response tickets back to
// tokens by index, returning the DeviceNotRegistered ones (and only those) for pruning.
public sealed class ExpoPushSenderTests
{
    [Fact]
    public async Task Sends_messages_and_returns_unregistered_tokens_to_prune()
    {
        // One ok, one DeviceNotRegistered, one generic error — positional to the sent tokens.
        var handler = new StubHandler(req =>
        {
            Assert.Equal("/--/api/v2/push/send", req.RequestUri!.AbsolutePath);
            const string json = """
            { "data": [
                { "status": "ok", "id": "1" },
                { "status": "error", "message": "gone", "details": { "error": "DeviceNotRegistered" } },
                { "status": "error", "message": "oops", "details": { "error": "MessageTooBig" } }
            ] }
            """;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        });
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://exp.host") };
        var sender = new ExpoPushSender(http, NullLogger<ExpoPushSender>.Instance);

        var invalid = await sender.SendAsync(
            ["tok-ok", "tok-gone", "tok-toobig"], "Trip", "Added an activity",
            new Dictionary<string, string> { ["tripId"] = "t1" }, TestContext.Current.CancellationToken);

        Assert.Equal(["tok-gone"], invalid);

        // The body carried one message per token, with the title/body passed through.
        using var sent = JsonDocument.Parse(handler.LastRequestBody!);
        var messages = sent.RootElement.EnumerateArray().ToArray();
        Assert.Equal(3, messages.Length);
        Assert.Equal("tok-ok", messages[0].GetProperty("to").GetString());
        Assert.Equal("Added an activity", messages[0].GetProperty("body").GetString());
    }

    [Fact]
    public async Task Non_success_response_prunes_nothing()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://exp.host") };
        var sender = new ExpoPushSender(http, NullLogger<ExpoPushSender>.Instance);

        var invalid = await sender.SendAsync(
            ["tok"], "Trip", "body", new Dictionary<string, string>(), TestContext.Current.CancellationToken);

        Assert.Empty(invalid);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public string? LastRequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Content is not null)
            {
                LastRequestBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }
            return respond(request);
        }
    }
}
