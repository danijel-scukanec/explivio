var builder = DistributedApplication.CreateBuilder(args);

// The Explivio API — orchestrated by Aspire. Backing resources (SQL, Cosmos,
// Service Bus, Redis) are added here in later phases.
builder.AddProject<Projects.Explivio_API>("api");

builder.Build().Run();
