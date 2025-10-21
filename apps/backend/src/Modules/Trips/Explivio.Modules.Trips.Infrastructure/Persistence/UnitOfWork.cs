using Explivio.Modules.Trips.Application.Abstractions;

namespace Explivio.Modules.Trips.Infrastructure.Persistence;

internal sealed class UnitOfWork : IUnitOfWork
{
    private readonly TripsDbContext _db;

    public UnitOfWork(TripsDbContext db) => _db = db;

    public Task<int> SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}