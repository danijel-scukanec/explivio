namespace Explivio.API.Modules.Gallery;

// F26: one card in the public gallery. Served from the TripPopularity read model (name, destination,
// like count, owner) plus per-viewer flags resolved from the write model — whether the caller liked the
// trip and whether they follow its owner.
public record GalleryItemResponse(
    Guid TripId,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    bool HasCoverPhoto,
    int LikeCount,
    bool LikedByMe,
    Guid OwnerUserId,
    string OwnerDisplayName,
    bool FollowedByMe,
    bool IsMine);
