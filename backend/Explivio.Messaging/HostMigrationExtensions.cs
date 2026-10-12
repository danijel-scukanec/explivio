using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Explivio.Messaging;

public static class HostMigrationExtensions
{
    // Applies a consumer's own migrations on startup, retried briefly to tolerate SQL still warming
    // up under the Aspire AppHost. Each consumer owns an isolated schema, so auto-migrating here is
    // safe — it never touches another context's tables. MigrateAsync is idempotent: it applies only
    // pending migrations.
    public static async Task MigrateDbContextAsync<TContext>(
        this IHost app, int attempts = 10, TimeSpan? delay = null)
        where TContext : DbContext
    {
        var retryDelay = delay ?? TimeSpan.FromSeconds(3);
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(TContext).Name);

        for (var attempt = 1; attempt <= attempts; attempt++)
        {
            try
            {
                using var scope = app.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<TContext>();
                await db.Database.MigrateAsync();
                return;
            }
            catch (Exception ex) when (attempt < attempts)
            {
                logger.LogWarning(ex, "Migration attempt {Attempt} failed; retrying.", attempt);
                await Task.Delay(retryDelay);
            }
        }
    }
}
