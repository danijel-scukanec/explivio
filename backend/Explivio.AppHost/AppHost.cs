var builder = DistributedApplication.CreateBuilder(args);

// F11: SQL Server, now owned by the Aspire model (it was previously supplied through each service's
// appsettings — see F05, which deliberately parked SQL here until the deploy step). Locally it runs
// as a container, so one `aspire run` brings the database up alongside everything else; the same
// declaration provisions Azure SQL Database when deployed. A data volume persists the local database
// across runs so it doesn't have to be re-seeded each time.
var sql = builder.AddAzureSqlServer("sql")
    .RunAsContainer(container => container.WithDataVolume());

// The application database. The Aspire resource is named "sqlserver" so its injected connection
// string lands under the existing ConnectionStrings:SqlServer key every service already reads
// (configuration keys are case-insensitive), while the physical database keeps its "Explivio" name.
var database = sql.AddDatabase("sqlserver", "Explivio");

// F02/F11: Application Insights for distributed telemetry once deployed. Only added in publish mode
// (azd deploy): it has no local emulator, so referencing it during `aspire run` would leave each
// service waiting on an Azure resource that can't be provisioned locally. Locally, telemetry goes to
// the Aspire dashboard via OTLP instead; ServiceDefaults enables the Azure Monitor exporter only when
// the injected APPLICATIONINSIGHTS_CONNECTION_STRING is present (i.e. when deployed).
var appInsights = builder.ExecutionContext.IsPublishMode
    ? builder.AddAzureApplicationInsights("appinsights")
    : null;

// F14: Cosmos DB for the RAG vector store (place embeddings + vector search). Runs locally as the
// vNext/preview emulator container, which — unlike the classic emulator — supports vector search;
// RunAsPreviewEmulator is marked experimental (ASPIRECOSMOSDB001), hence the suppression. When
// deployed it provisions real Azure Cosmos DB (serverless). The API creates the vector-indexed
// container itself on startup (the embedding policy can't be expressed here), so only the account and
// database are declared.
//
// Locally the Cosmos vNext/preview emulator is heavy and unstable (it runs Postgres + builds a
// DiskANN index and can wedge the app), so — like Application Insights — it is NOT part of a normal
// `aspire run`: the API falls back to the in-memory retriever and the local run stays stable. Set
// EXPLIVIO_COSMOS_EMULATOR=true to opt into the emulator when you specifically want to exercise the
// Cosmos vector path locally. In publish mode it is always the real Azure resource.
var useCosmosEmulator = string.Equals(
    builder.Configuration["EXPLIVIO_COSMOS_EMULATOR"], "true", StringComparison.OrdinalIgnoreCase);

IResourceBuilder<AzureCosmosDBResource>? cosmos = null;
if (builder.ExecutionContext.IsPublishMode)
{
    cosmos = builder.AddAzureCosmosDB("cosmos");
}
else if (useCosmosEmulator)
{
#pragma warning disable ASPIRECOSMOSDB001
    cosmos = builder.AddAzureCosmosDB("cosmos").RunAsPreviewEmulator();
#pragma warning restore ASPIRECOSMOSDB001
}

cosmos?.AddCosmosDatabase("explivio");

// F05: Service Bus for the transactional outbox. Runs as the local emulator (Docker) in dev and
// provisions real Azure Service Bus when deployed. Domain events are published to this topic;
// the AI (F06) and Notifications (F07) workers will add subscriptions here later.
var serviceBus = builder.AddAzureServiceBus("messaging")
    .RunAsEmulator();

// Domain events fan out via a topic. Each worker gets its own subscription so it sees every
// event independently (the emulator also requires a topic to declare at least one subscription).
var domainEvents = serviceBus.AddServiceBusTopic("domain-events");

// F06: the AI worker's subscription. After MaxDeliveryCount failed attempts a message is
// dead-lettered instead of being redelivered forever.
var aiWorkerSubscription = domainEvents.AddServiceBusSubscription("ai-worker");
aiWorkerSubscription.Resource.MaxDeliveryCount = 5;

// F07: the notifications worker's subscription. Same dead-letter posture as the AI worker.
var notificationsWorkerSubscription = domainEvents.AddServiceBusSubscription("notifications-worker");
notificationsWorkerSubscription.Resource.MaxDeliveryCount = 5;

// F08: the read-model projector's subscription (hosted inside the API). It sees every domain event
// and maintains the TripSummary read model.
var readModelSubscription = domainEvents.AddServiceBusSubscription("read-model");
readModelSubscription.Resource.MaxDeliveryCount = 5;

// The Explivio API, orchestrated by Aspire. It now takes both its SQL database and the Service Bus
// from the AppHost; the injected connection strings replace the appsettings values in every
// environment.
var api = builder.AddProject<Projects.Explivio_API>("api")
    .WithReference(database)
    .WaitFor(database)
    .WithReference(serviceBus)
    .WaitFor(serviceBus);

// F14: give the API the Cosmos connection when Cosmos exists (real in publish mode, or the opt-in
// local emulator). Without it the API uses the in-memory retriever. Only wait on the local emulator —
// in publish mode the reference is enough.
if (cosmos is not null)
{
    api.WithReference(cosmos);
    if (useCosmosEmulator)
    {
        api.WaitFor(cosmos);
    }
}

// F06: the AI worker. Consumes the 'ai-worker' subscription and stores its inbox in the shared SQL
// database (its own "worker" schema).
var aiWorker = builder.AddProject<Projects.Explivio_AIWorker>("aiworker")
    .WithReference(database)
    .WaitFor(database)
    .WithReference(serviceBus)
    .WaitFor(serviceBus);

// F07: the notifications worker. Consumes the 'notifications-worker' subscription and stores its
// inbox in the shared SQL database (its own "notifications" schema).
var notificationsWorker = builder.AddProject<Projects.Explivio_NotificationsWorker>("notificationsworker")
    .WithReference(database)
    .WaitFor(database)
    .WithReference(serviceBus)
    .WaitFor(serviceBus);

// Wire Application Insights into every service, but only when it exists (publish/deploy mode) — see
// its declaration above. This injects APPLICATIONINSIGHTS_CONNECTION_STRING, which ServiceDefaults
// keys the Azure Monitor exporter off.
if (appInsights is not null)
{
    api.WithReference(appInsights);
    aiWorker.WithReference(appInsights);
    notificationsWorker.WithReference(appInsights);
}

builder.Build().Run();
