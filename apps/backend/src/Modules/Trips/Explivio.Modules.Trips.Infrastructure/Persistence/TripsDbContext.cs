using Explivio.Modules.Trips.Domain;
using Microsoft.EntityFrameworkCore;

namespace Explivio.Modules.Trips.Infrastructure.Persistence;

public sealed class TripsDbContext : DbContext
{
    public TripsDbContext(DbContextOptions<TripsDbContext> options) : base(options) { }

    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<Destination> Destinations => Set<Destination>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TripsDbContext).Assembly);
    }
}