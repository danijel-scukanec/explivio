using Explivio.Modules.Trips.Domain;

namespace Explivio.Modules.Trips.Application.Abstractions.Repositories;

public interface IDestinationRepository
{
    Task AddAsync(Destination destination, CancellationToken cancellationToken = default);
}