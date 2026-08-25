using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Explivio.NotificationsWorker.Inbox;

// F07: lets `dotnet ef migrations add` build the context without spinning up the whole web host
// (and its Service Bus processor). The connection string is irrelevant for generating migrations —
// EF only needs the provider and model — so a placeholder is fine here.
public sealed class NotificationsDbContextFactory : IDesignTimeDbContextFactory<NotificationsDbContext>
{
    public NotificationsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<NotificationsDbContext>()
            .UseSqlServer(
                "Server=localhost;Database=Explivio;Trusted_Connection=False;",
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", NotificationsDbContext.Schema))
            .Options;

        return new NotificationsDbContext(options);
    }
}
