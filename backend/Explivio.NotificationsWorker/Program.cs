using Explivio.NotificationsWorker.Consuming;
using Explivio.NotificationsWorker.Inbox;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// OpenTelemetry, health checks and resilience, shared with the API via ServiceDefaults.
builder.AddServiceDefaults();

// Inbox dedupe store — the worker's own context over the shared SQL database. Gated on the
// connection string like the API's DbContext, so the worker still builds and serves health checks
// when SQL isn't configured.
var sqlConnectionString = builder.Configuration.GetConnectionString("SqlServer");
if (!string.IsNullOrWhiteSpace(sqlConnectionString))
{
    builder.Services.AddDbContext<NotificationsDbContext>(options =>
        options.UseSqlServer(sqlConnectionString, sql =>
            sql.MigrationsHistoryTable("__EFMigrationsHistory", NotificationsDbContext.Schema)));
}

builder.Services.AddSingleton<DomainEventDispatcher>();

// Consume domain events only when a broker is configured (the Aspire AppHost injects "messaging";
// Azure provides it in production). Broker-free, the worker still starts and serves health checks.
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("messaging")))
{
    builder.AddAzureServiceBusClient("messaging");
    builder.Services.AddHostedService<DomainEventProcessor>();
}

var app = builder.Build();

app.MapDefaultEndpoints();

// Apply the worker's own inbox migration on startup. It targets only the "notifications" schema, so
// it never touches the API's tables. Retried briefly to tolerate SQL still warming up under the AppHost.
if (!string.IsNullOrWhiteSpace(sqlConnectionString))
{
    await MigrateInboxAsync(app);
}

app.Run();

static async Task MigrateInboxAsync(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();

    for (var attempt = 1; attempt <= 10; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<NotificationsDbContext>();
            await db.Database.MigrateAsync();
            return;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning(ex, "Inbox migration attempt {Attempt} failed; retrying.", attempt);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

// Exposed so integration tests can host the worker via WebApplicationFactory.
public partial class Program;
