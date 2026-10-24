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

    // All flags, so GET /features can report each one's state without reflection.
    public static readonly IReadOnlyList<string> All = [AiItineraryGeneration, TripCoverPhotos, TripDocuments];
}
