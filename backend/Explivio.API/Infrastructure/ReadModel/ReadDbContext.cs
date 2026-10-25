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

    // F20: in-app notifications. The API owns and migrates the table; the Notifications Worker writes
    // rows to it (mapped ExcludeFromMigrations on its side). The API reads + marks them read here.
    public DbSet<Notification> Notifications => Set<Notification>();

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

        // F20: notifications read model. Indexed by recipient + recency for the per-user feed, and by
        // (recipient, unread) for the badge count.
        var notification = modelBuilder.Entity<Notification>();
        notification.ToTable("Notifications");
        notification.HasKey(n => n.Id);
        notification.Property(n => n.TripName).HasMaxLength(200);
        notification.Property(n => n.Kind).HasMaxLength(50);
        notification.Property(n => n.Detail).HasMaxLength(500);
        notification.HasIndex(n => new { n.UserId, n.CreatedAt });
        notification.HasIndex(n => new { n.UserId, n.IsRead });

        modelBuilder.ConfigureInbox<ProjectionInboxMessage>();
    }
}
