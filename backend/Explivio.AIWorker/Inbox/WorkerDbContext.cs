using Microsoft.EntityFrameworkCore;

namespace Explivio.AIWorker.Inbox;

// F06: the worker's own EF context, holding just the inbox dedupe table. It shares the physical
// SQL database with the API but lives in its own "worker" schema and keeps a separate migrations
// history table, so the two contexts evolve independently and never collide.
public sealed class WorkerDbContext(DbContextOptions<WorkerDbContext> options) : DbContext(options)
{
    public const string Schema = "worker";

    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        var inbox = modelBuilder.Entity<InboxMessage>();
        inbox.ToTable("InboxMessages");
        inbox.HasKey(m => m.MessageId);
        inbox.Property(m => m.MessageId).HasMaxLength(200);
        inbox.Property(m => m.Subject).HasMaxLength(200);
    }
}
