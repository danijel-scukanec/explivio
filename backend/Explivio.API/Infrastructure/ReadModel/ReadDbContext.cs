using Explivio.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Infrastructure.ReadModel;

// F08: the read side's own EF context. It shares the physical SQL database with the write model
// (AppDbContext) but lives in its own "read" schema with a separate migrations history, so the
// read and write models evolve independently — the CQRS separation made structural.
public sealed class ReadDbContext(DbContextOptions<ReadDbContext> options) : DbContext(options)
{
    public const string Schema = "read";

    public DbSet<TripSummary> TripSummaries => Set<TripSummary>();
    public DbSet<TripPopularity> TripPopularity => Set<TripPopularity>();
    public DbSet<ProjectionInboxMessage> InboxMessages => Set<ProjectionInboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        var summary = modelBuilder.Entity<TripSummary>();
        summary.ToTable("TripSummaries");
        summary.HasKey(s => s.TripId);
        summary.Property(s => s.Name).HasMaxLength(200);
        summary.Property(s => s.Destination).HasMaxLength(200);
        summary.Property(s => s.TotalSpend).HasColumnType("decimal(18,2)");
        summary.HasIndex(s => s.UserId);

        // F26: the gallery / like-count read model.
        var popularity = modelBuilder.Entity<TripPopularity>();
        popularity.ToTable("TripPopularity");
        popularity.HasKey(p => p.TripId);
        popularity.Property(p => p.Name).HasMaxLength(200);
        popularity.Property(p => p.Destination).HasMaxLength(200);
        // The gallery lists public trips ordered by likes/recency.
        popularity.HasIndex(p => new { p.IsPublic, p.LikeCount });

        modelBuilder.ConfigureInbox<ProjectionInboxMessage>();
    }
}
