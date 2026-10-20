using Explivio.API.Infrastructure.Idempotency;
using Explivio.API.Infrastructure.Outbox;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Users;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Budget;
using Explivio.API.Modules.Reservations;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.Database;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<TripStop> TripStops => Set<TripStop>();
    public DbSet<TripMember> TripMembers => Set<TripMember>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
