using Explivio.Messaging;
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

    // F20: the in-app notification rows this worker writes. The table is owned and migrated by the
    // API (in its "read" schema); here it's mapped ExcludeFromMigrations so the worker writes to it
    // without trying to create it. Written in the same transaction as the inbox row (exactly-once).
    public DbSet<Notification> Notifications => Set<Notification>();

    // F20 (push): registered devices. Owned and migrated by the API (in "read"); the worker only reads
    // tokens from it to send push (and deletes rows Expo reports as no longer registered), so it's
    // mapped ExcludeFromMigrations here too.
    public DbSet<PushDevice> PushDevices => Set<PushDevice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ConfigureInbox<InboxMessage>();

        var notification = modelBuilder.Entity<Notification>();
        notification.ToTable("Notifications", "read", t => t.ExcludeFromMigrations());
        notification.HasKey(n => n.Id);

        var pushDevice = modelBuilder.Entity<PushDevice>();
        pushDevice.ToTable("PushDevices", "read", t => t.ExcludeFromMigrations());
        pushDevice.HasKey(d => d.Id);
    }
}
