using Explivio.API.Infrastructure.Database;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Trips.DeleteTrip;

public class DeleteTripHandler(AppDbContext db) : IRequestHandler<DeleteTripCommand, bool>
{
    public async Task<bool> Handle(DeleteTripCommand command, CancellationToken cancellationToken)
    {
        var deleted = await db.Trips
            .Where(t => t.Id == command.TripId && t.UserId == command.UserId)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted > 0;
    }
}
