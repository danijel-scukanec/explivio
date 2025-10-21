using Explivio.Modules.Trips.Application;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Explivio.Modules.Trips.Infrastructure;
using FluentValidation;

namespace Explivio.Modules.Trips.Presentation;

public static class TripsModule
{
    /// <summary>Registers Trips module (Application + Infrastructure + Controllers).</summary>
    public static IServiceCollection AddTripsModule(this IServiceCollection services, IConfiguration config)
    {
        // Application
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining<ITripsApplicationAssemblyMarker>();
        });
        services.AddValidatorsFromAssembly(typeof(ITripsApplicationAssemblyMarker).Assembly);
        //services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>)); // if you have one

        // Infrastructure (EF Core, repositories, UoW, etc.)
        var cs =
            config.GetSection("Modules:Trips:ConnectionString").Value
            ?? config.GetConnectionString("Default");

        services.AddTripsInfrastructure(config);

        // Presentation (discover controllers in this assembly)
        services.AddControllers().AddApplicationPart(typeof(TripsModule).Assembly);

        // (Optional) module health checks
        //services.AddHealthChecks().AddCheck<TripsDbHealthCheck>("trips_db");

        return services;
    }
}