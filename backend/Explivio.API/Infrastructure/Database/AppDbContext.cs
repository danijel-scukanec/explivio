using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Users;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Budget;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.Database;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Expense> Expenses => Set<Expense>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
