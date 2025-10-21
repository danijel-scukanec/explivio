using Explivio.Modules.Trips.Application.Abstractions;
using Explivio.Modules.Trips.Application.Abstractions.Repositories;
using Explivio.Modules.Trips.Infrastructure.Persistence;
using Explivio.Modules.Trips.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Explivio.Modules.Trips.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTripsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var cs = configuration.GetConnectionString("TripsDb") ?? "Data Source=explivio_trips_dev.db";
        services.AddDbContext<TripsDbContext>(o => o.UseSqlite(cs));

        services.AddScoped<ITripRepository, TripRepository>();
        services.AddScoped<IDestinationRepository, DestinationRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        return services;
    }
}