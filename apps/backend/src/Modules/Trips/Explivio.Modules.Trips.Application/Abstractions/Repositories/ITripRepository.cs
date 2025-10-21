using Explivio.Modules.Trips.Domain;

namespace Explivio.Modules.Trips.Application.Abstractions.Repositories;

public interface ITripRepository
{
    Task AddAsync(Trip trip, CancellationToken cancellationToken = default);
}