using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outcomes;
using Explivio.API.Infrastructure.Storage;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.DeleteTrip;

// F22: storage is injected as nullable so deletion still works when the cover-photo feature isn't
// configured (no "blobs" connection string).
public class DeleteTripHandler(AppDbContext db, IPhotoStorage? storage = null) : IRequestHandler<DeleteTripCommand, Result>
{
    public async Task<Result> Handle(DeleteTripCommand command, CancellationToken cancellationToken)
    {
        // F08: load then remove (instead of a bulk ExecuteDelete) so the aggregate can raise
        // TripDeletedDomainEvent and the outbox interceptor captures it in the same transaction.
        var trip = await db.Trips
            .FirstOrDefaultAsync(t => t.Id == command.TripId, cancellationToken);

        if (trip is null)
        {
            return Error.NotFound("Trip.NotFound", $"No trip with id '{command.TripId}' was found.");
        }

        trip.Delete();
        db.Trips.Remove(trip);
        await db.SaveChangesAsync(cancellationToken);

        // F22: best-effort cover-photo cleanup so a deleted trip doesn't orphan its blob. Done after
        // the delete commits; a storage hiccup here must not fail the (already-succeeded) deletion.
        if (storage is not null && trip.HasCoverPhoto)
        {
            try
            {
                await storage.DeleteCoverAsync(trip.Id, cancellationToken);
            }
            catch
            {
                // Swallowed: the trip is gone; an orphaned blob is harmless and can be reaped later.
            }
        }

        return Result.Success();
    }
}
