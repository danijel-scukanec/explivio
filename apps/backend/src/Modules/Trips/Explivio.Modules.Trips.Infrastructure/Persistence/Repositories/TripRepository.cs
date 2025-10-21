using Explivio.Modules.Trips.Application.Abstractions.Repositories;
using Explivio.Modules.Trips.Domain;

namespace Explivio.Modules.Trips.Infrastructure.Persistence.Repositories;

internal sealed class TripRepository : ITripRepository
{
    private readonly TripsDbContext _db;

    public TripRepository(TripsDbContext db) => _db = db;
    
    public async Task AddAsync(Trip trip, CancellationToken ct = default)
    {
        await _db.Trips.AddAsync(trip, ct);
    }
}