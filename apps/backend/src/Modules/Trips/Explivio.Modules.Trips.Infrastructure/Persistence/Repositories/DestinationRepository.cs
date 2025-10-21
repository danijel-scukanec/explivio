using Explivio.Modules.Trips.Application.Abstractions.Repositories;
using Explivio.Modules.Trips.Domain;

namespace Explivio.Modules.Trips.Infrastructure.Persistence.Repositories;

internal sealed class DestinationRepository : IDestinationRepository
{
    private readonly TripsDbContext _db;

    public DestinationRepository(TripsDbContext db) => _db = db;
    
    public async Task AddAsync(Destination destination, CancellationToken ct = default)
    {
        await _db.Destinations.AddAsync(destination, ct);
    }
}