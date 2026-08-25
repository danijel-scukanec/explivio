using Microsoft.EntityFrameworkCore;

namespace Explivio.NotificationsWorker.Inbox;

// F07: the worker's own EF context, holding just the inbox dedupe table. It shares the physical
// SQL database with the API (and the AI worker) but lives in its own "notifications" schema and
// keeps a separate migrations history table, so each context evolves independently and never
// collides.
public sealed class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options) : DbContext(options)
{
    public const string Schema = "notifications";

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
