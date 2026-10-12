using Explivio.Messaging;
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
    builder.Services.AddHostedService<NotificationsWorkerProcessor>();
}

var app = builder.Build();

app.MapDefaultEndpoints();

// Apply the worker's own inbox migration on startup (isolated "notifications" schema).
if (!string.IsNullOrWhiteSpace(sqlConnectionString))
{
    await app.MigrateDbContextAsync<NotificationsDbContext>();
}

app.Run();

// Exposed so integration tests can host the worker via WebApplicationFactory.
public partial class Program;
