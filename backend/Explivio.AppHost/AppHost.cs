var builder = DistributedApplication.CreateBuilder(args);

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

domainEvents.AddServiceBusSubscription("notifications-worker"); // F07

// The Explivio API, orchestrated by Aspire. SQL is still supplied via appsettings for now;
// it will move into the AppHost in a later step.
builder.AddProject<Projects.Explivio_API>("api")
    .WithReference(serviceBus)
    .WaitFor(serviceBus);

// F06: the AI worker. Consumes the 'ai-worker' subscription; SQL (the inbox store) is still
// supplied via its own appsettings for now, mirroring the API.
builder.AddProject<Projects.Explivio_AIWorker>("aiworker")
    .WithReference(serviceBus)
    .WaitFor(serviceBus);

builder.Build().Run();
