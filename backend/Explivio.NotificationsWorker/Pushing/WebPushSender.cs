using System.Net;
using System.Text.Json;
using Explivio.Messaging;
using WebPush;
using WebPush.Model;

namespace Explivio.NotificationsWorker.Pushing;

// F20 (web push): sends through the browsers' Web Push services via the ClosureOSS.WebPush library
// (VAPID auth + aes128gcm payload encryption). One encrypted POST per subscription — there is no batch
// API — so we loop, isolate per-subscription failures, and collect the endpoints the push service
// reports as permanently gone (HTTP 404/410 → the user cleared site data or the subscription expired)
// so the caller can prune them. Best-effort by contract: the processor calls this outside the
// notification's persistence and never lets it throw. The WebPushClient (and its internal HttpClient)
// is reused for the sender's lifetime, which is registered as a singleton.
public sealed class WebPushSender : IWebPushSender
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly WebPushClient _client = new();
    private readonly WebPushOptions _options;
    private readonly ILogger<WebPushSender> _logger;

    public WebPushSender(VapidConfiguration vapid, ILogger<WebPushSender> logger)
    {
        _logger = logger;
        _options = new WebPushOptions
        {
            VapidDetails = new VapidDetails(vapid.Subject, vapid.PublicKey, vapid.PrivateKey),
            ContentEncoding = ContentEncoding.Aes128gcm,
        };
    }

    public async Task<IReadOnlyCollection<string>> SendAsync(
        IReadOnlyCollection<WebPushSubscription> subscriptions,
        string title,
        string body,
        IReadOnlyDictionary<string, string> data,
        CancellationToken cancellationToken)
    {
        var invalid = new List<string>();

        // The service worker reads this shape in its "push" handler (event.data.json()).
        var payload = JsonSerializer.Serialize(new { title, body, data }, SerializerOptions);

        foreach (var sub in subscriptions)
        {
            if (string.IsNullOrWhiteSpace(sub.Endpoint)) continue;

            try
            {
                var pushSubscription = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await _client.SendNotificationAsync(pushSubscription, payload, _options, cancellationToken);
            }
            catch (WebPushException ex) when (
                ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
            {
                // The subscription is dead — mark the endpoint for pruning.
                invalid.Add(sub.Endpoint);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex, "Web push send failed for one subscription; leaving it for a later send.");
            }
        }

        return invalid;
    }
}

// F20 (web push): the VAPID keys + subject the sender signs with. Built in Program.cs from config
// (WebPush:PublicKey / WebPush:PrivateKey / WebPush:Subject) and registered when web push is on.
public sealed record VapidConfiguration(string Subject, string PublicKey, string PrivateKey);
