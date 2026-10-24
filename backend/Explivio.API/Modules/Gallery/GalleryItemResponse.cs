namespace Explivio.API.Modules.Gallery;

// F26: one card in the public gallery. Served from the TripPopularity read model (name, destination,
// like count) plus a per-viewer "did I like this" flag resolved from the write model.
public record GalleryItemResponse(
    Guid TripId,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    bool HasCoverPhoto,
    int LikeCount,
    bool LikedByMe);
