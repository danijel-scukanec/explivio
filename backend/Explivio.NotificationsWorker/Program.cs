using Explivio.Messaging;
using Explivio.NotificationsWorker.Consuming;
using Explivio.NotificationsWorker.Inbox;
using Explivio.NotificationsWorker.Pushing;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// OpenTelemetry, health checks and resilience, shared with the API via ServiceDefaults.
builder.AddServiceDefaults();

// F20 (push): the push sender. Enabled only when configured (PushNotifications:Enabled) — it needs
// FCM credentials on the Expo project to actually deliver, so it's off by default and the worker still
// fans out in-app notifications. When off, a no-op sender keeps the processor's dependency satisfied.
var pushEnabled = builder.Configuration.GetValue("PushNotifications:Enabled", false);
if (pushEnabled)
{
    var expoAccessToken = builder.Configuration["PushNotifications:ExpoAccessToken"];
    builder.Services.AddHttpClient<IPushNotificationSender, ExpoPushSender>(http =>
    {
        http.BaseAddress = new Uri("https://exp.host");
        // Optional: required only if "Enhanced Security for Push Notifications" is on for the project.
        if (!string.IsNullOrWhiteSpace(expoAccessToken))
        {
            http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", expoAccessToken);
        }
    });
}
else
{
    builder.Services.AddSingleton<IPushNotificationSender, NullPushSender>();
}

// F20 (web push): the browser Web Push sender. Enabled alongside Expo (same PushNotifications:Enabled
// gate) but additionally needs a VAPID keypair — the public key is served to clients so they can
// subscribe, and both keys sign the push. Off (no-op) unless enabled AND both keys are configured, so
// the worker still fans out in-app + Expo push when web push isn't set up.
var vapidPublicKey = builder.Configuration["WebPush:PublicKey"];
var vapidPrivateKey = builder.Configuration["WebPush:PrivateKey"];
var vapidSubject = builder.Configuration["WebPush:Subject"];
if (pushEnabled && !string.IsNullOrWhiteSpace(vapidPublicKey) && !string.IsNullOrWhiteSpace(vapidPrivateKey))
{
    builder.Services.AddSingleton(new VapidConfiguration(
        string.IsNullOrWhiteSpace(vapidSubject) ? "mailto:admin@explivio.app" : vapidSubject,
        vapidPublicKey,
        vapidPrivateKey));
    builder.Services.AddSingleton<IWebPushSender, WebPushSender>();
}
else
{
    builder.Services.AddSingleton<IWebPushSender, NullWebPushSender>();
}

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
