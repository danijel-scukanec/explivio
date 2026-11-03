using System.Net.Http.Json;
using System.Text.Json;

namespace Explivio.NotificationsWorker.Pushing;

// F20 (push): sends through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
// One POST carries up to 100 messages; we chunk and map each response ticket back to its token by index,
// collecting the tokens Expo reports as DeviceNotRegistered so the caller can prune them. Best-effort by
// contract — the processor calls this outside the notification's persistence and never lets it throw.
public sealed class ExpoPushSender(HttpClient http, ILogger<ExpoPushSender> logger) : IPushNotificationSender
{
    private const int BatchSize = 100;
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyCollection<string>> SendAsync(
        IReadOnlyCollection<string> tokens,
        string title,
        string body,
        IReadOnlyDictionary<string, string> data,
        CancellationToken cancellationToken)
    {
        var invalid = new List<string>();
        var batch = tokens.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToArray();

        for (var offset = 0; offset < batch.Length; offset += BatchSize)
        {
            var chunk = batch.Skip(offset).Take(BatchSize).ToArray();
            var messages = chunk.Select(to => new ExpoMessage(to, title, body, data)).ToArray();

            using var response = await http.PostAsJsonAsync(
                "/--/api/v2/push/send", messages, SerializerOptions, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Expo push responded {Status} for {Count} token(s); leaving them for a later send.",
                    (int)response.StatusCode, chunk.Length);
                continue;
            }

            var payload = await response.Content.ReadFromJsonAsync<ExpoResponse>(SerializerOptions, cancellationToken);
            var tickets = payload?.Data;
            if (tickets is null) continue;

            // Tickets are positional to the messages we sent, so index maps back to the token.
            for (var i = 0; i < tickets.Count && i < chunk.Length; i++)
            {
                var ticket = tickets[i];
                if (ticket.Status == "ok") continue;

                if (string.Equals(ticket.Details?.Error, "DeviceNotRegistered", StringComparison.OrdinalIgnoreCase))
                {
                    invalid.Add(chunk[i]);
                }
                else
                {
                    logger.LogWarning("Expo push ticket error for a device: {Error} ({Message}).",
                        ticket.Details?.Error, ticket.Message);
                }
            }
        }

        return invalid;
    }

    private sealed record ExpoMessage(string To, string Title, string Body, IReadOnlyDictionary<string, string> Data);

    private sealed record ExpoResponse(IReadOnlyList<ExpoTicket>? Data);

    private sealed record ExpoTicket(string? Status, string? Message, ExpoTicketDetails? Details);

    private sealed record ExpoTicketDetails(string? Error);
}
