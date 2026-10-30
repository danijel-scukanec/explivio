namespace Explivio.API.Infrastructure.Features;

// F32: the application's feature flags, named in one place so endpoints and the client agree on the
// strings. Flags are evaluated by Microsoft.FeatureManagement from the "FeatureManagement" section of
// configuration (appsettings / env / user-secrets locally; Azure App Configuration is the optional
// cloud-backed source, not wired here). Add a flag here, declare it in configuration, gate with
// RequireFeature, and expose it through GET /features so the client can react.
public static class FeatureFlags
{
    // Gates AI itinerary generation (the /generate endpoint and the streaming hub). A natural flag:
    // the feature is optional and, with a real model configured, the expensive one to turn off.
    public const string AiItineraryGeneration = "AiItineraryGeneration";

    // Gates trip cover-photo upload/serve/delete.
    public const string TripCoverPhotos = "TripCoverPhotos";

    // Gates trip document upload/list/download/delete (F24). Blob-backed, like cover photos.
    public const string TripDocuments = "TripDocuments";

    // F16: gates the AI chat assistant (the /hubs/trip-assistant SignalR hub). Like
    // AiItineraryGeneration, it's the model-backed feature you'd most want to switch off.
    public const string AiAssistant = "AiAssistant";

    // F17: gates receipt scanning — the vision scan endpoint and the per-expense receipt image
    // upload/serve/delete. Needs a real multimodal model (vision), so it's a natural switch.
    public const string AiReceiptScanning = "AiReceiptScanning";

    // F29: gates the AI trip recap — the generation hub and the recap read endpoint. Model-backed, so
    // a natural switch to turn off with the other AI features.
    public const string AiTripRecap = "AiTripRecap";

    // F18: gates booking-email parsing — the parse endpoint that turns a confirmation into draft
    // activities/reservations. Model-backed (text + vision), so a natural switch.
    public const string AiEmailParsing = "AiEmailParsing";

    // All flags, so GET /features can report each one's state without reflection.
    public static readonly IReadOnlyList<string> All =
        [AiItineraryGeneration, TripCoverPhotos, TripDocuments, AiAssistant, AiReceiptScanning, AiTripRecap, AiEmailParsing];
}
