using System.Security.Claims;
using System.Text.Json.Serialization;
using Asp.Versioning;
using Asp.Versioning.Builder;
using Explivio.API.Infrastructure.Ai;
using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Behaviors;
using Explivio.API.Infrastructure.Idempotency;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Outbox;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Users;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Itinerary.GenerateItinerary;
using Explivio.API.Modules.Budget;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Aspire cross-cutting: OpenTelemetry, health checks, resilience, service discovery
builder.AddServiceDefaults();

builder.Services.AddOpenApi(options =>
    options.AddDocumentTransformer<ReplaceVersionParameterTransformer>());

// F03: consistent error responses. ProblemDetails (RFC 9457) is the single wire format
// for every error — from the Result flow, from validation, and from the exception handler.
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Instance ??=
            $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";
        // Ties a client-visible error to its OpenTelemetry trace (F02).
        context.ProblemDetails.Extensions.TryAdd(
            "traceId",
            System.Diagnostics.Activity.Current?.Id ?? context.HttpContext.TraceIdentifier);
    };
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    // Order matters: Logging wraps Validation wraps the handler.
    cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
});
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// F05: the outbox interceptor writes domain events into the same transaction as the business change.
builder.Services.AddSingleton<ConvertDomainEventsToOutboxMessagesInterceptor>();
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer"))
           .AddInterceptors(sp.GetRequiredService<ConvertDomainEventsToOutboxMessagesInterceptor>()));

// F08: the read side. Its own context over the "read" schema of the same database, with a separate
// migrations history so the read and write models evolve independently (CQRS separation).
builder.Services.AddDbContext<ReadDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer"), sql =>
        sql.MigrationsHistoryTable("__EFMigrationsHistory", ReadDbContext.Schema)));

builder.Services.AddSingleton(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("CosmosDb");
    var databaseName = builder.Configuration["CosmosDb:DatabaseName"] ?? "explivio";
    return new Microsoft.Azure.Cosmos.CosmosClient(connectionString);
});

// F05: publish outbox events to Service Bus — only when a broker is configured (Aspire AppHost
// injects the "messaging" connection; Azure provides it in production). Without it the API and the
// integration tests still run: the interceptor keeps writing outbox rows, they just aren't
// published until a broker is present.
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("messaging")))
{
    builder.AddAzureServiceBusClient("messaging");
    builder.Services.AddHostedService<OutboxProcessor>();

    // F08: the read-model projector consumes those same events off its own subscription and keeps
    // the TripSummary read model current. Broker-free (tests), the read model just stays empty.
    builder.Services.AddHostedService<TripSummaryProjector>();
}

// F12: the AI chat client for itinerary generation. Real Azure OpenAI / GitHub Models client when
// configured (AI:Endpoint + AI:ApiKey), otherwise a deterministic dev stub — so the API builds and
// tests run with no credentials and no cost.
builder.Services.AddExplivioAi(builder.Configuration);

// F13: SignalR for streaming AI itinerary generation to the client (in-process; Azure SignalR is a
// later scaling swap). The ItineraryGenerationHub streams the generation token-by-token.
builder.Services.AddSignalR();

// F09: API versioning via URL segment (/v1/...). C# stays the source of truth for the
// version; the frontend regenerates types from the versioned OpenAPI spec.
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new UrlSegmentApiVersionReader();
});

// F09: per-user sliding-window rate limiting (429 + Retry-After as ProblemDetails).
builder.Services.AddExplivioRateLimiter(builder.Configuration);

builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// F08: apply the read model's own migration on startup. It targets only the "read" schema, so it
// never touches the write model's tables (AppDbContext is still migrated manually). Gated on SQL
// being configured; retried briefly to tolerate SQL still warming up under the AppHost.
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("SqlServer")))
{
    await MigrateReadModelAsync(app);
}

// F03: catch unhandled exceptions and empty error status codes, emit ProblemDetails for both.
app.UseExceptionHandler();
app.UseStatusCodePages();

// Aspire health endpoints (/health, /alive) — Development only by default
app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    // Inject a fake identity so RequireAuthorization() passes without a real B2C token
    app.Use((ctx, next) =>
    {
        ctx.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("sub", "00000000-0000-0000-0000-000000000001")], "dev"));
        return next();
    });
}

app.UseAuthentication();
app.UseAuthorization();

// Rate limiter runs after authentication so it can partition by the 'sub' claim.
app.UseRateLimiter();

// F04: boundary idempotency for mutating requests carrying an Idempotency-Key. After auth so it can
// scope keys by user, and after the rate limiter so throttled requests never reserve a key.
app.UseIdempotency();

// F09: all feature endpoints live under /v{version} (e.g. /v1/trips).
var versionSet = app.NewApiVersionSet()
    .HasApiVersion(new ApiVersion(1))
    .Build();
var api = app.MapGroup("/v{version:apiVersion}").WithApiVersionSet(versionSet);

api.MapTripsEndpoints();
api.MapUsersEndpoints();
api.MapItineraryEndpoints();
api.MapBudgetEndpoints();

// F13: the streaming itinerary-generation hub. Not versioned like the REST group — SignalR hubs are
// addressed by a stable path; the default CORS policy and auth apply as for the rest of the app.
app.MapHub<ItineraryGenerationHub>("/hubs/itinerary-generation");

app.Run();

// F08: apply the read model's migration, retrying while SQL warms up under the AppHost.
static async Task MigrateReadModelAsync(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();

    for (var attempt = 1; attempt <= 10; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var read = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
            await read.Database.MigrateAsync();
            return;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning(ex, "Read-model migration attempt {Attempt} failed; retrying.", attempt);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

// Exposes the implicit Program class to the integration test project (WebApplicationFactory<Program>).
public partial class Program;
