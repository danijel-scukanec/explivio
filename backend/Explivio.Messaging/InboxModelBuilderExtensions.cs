using Microsoft.EntityFrameworkCore;

namespace Explivio.Messaging;

public static class InboxModelBuilderExtensions
{
    // Maps a consumer's inbox entity to its "InboxMessages" table. The caller chooses the schema via
    // modelBuilder.HasDefaultSchema(...), so each consumer's inbox lives in its own schema with a
    // separate migrations history and never collides with the others in the shared database.
    public static void ConfigureInbox<TInbox>(this ModelBuilder modelBuilder)
        where TInbox : class, IInboxMessage
    {
        var inbox = modelBuilder.Entity<TInbox>();
        inbox.ToTable("InboxMessages");
        inbox.HasKey(m => m.MessageId);
        inbox.Property(m => m.MessageId).HasMaxLength(200);
        inbox.Property(m => m.Subject).HasMaxLength(200);
    }
}
