namespace Explivio.API.Modules.Itinerary.Assistant;

// F16: the payload the client streams to TripAssistantHub.Chat. The client keeps the running
// transcript and sends it each turn (the hub is stateless — no server-side history in v1). Roles are
// "user" / "assistant"; the newest user turn is the message to respond to.
public sealed record TripChatRequest(Guid TripId, IReadOnlyList<ChatTurn> Messages);

public sealed record ChatTurn(string Role, string Content);
