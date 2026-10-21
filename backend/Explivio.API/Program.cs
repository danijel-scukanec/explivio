using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Asp.Versioning;
using Asp.Versioning.Builder;
using Explivio.API.Infrastructure.Ai;
using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Behaviors;
using Explivio.API.Infrastructure.Idempotency;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Features;
using Explivio.API.Infrastructure.Fx;
using Explivio.API.Infrastructure.Outbox;
using Explivio.API.Infrastructure.Rag;
using Explivio.API.Infrastructure.ReadModel;
using Explivio.API.Infrastructure.Storage;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.Collaboration;
using Explivio.API.Modules.Users;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Itinerary.GenerateItinerary;
using Explivio.API.Modules.Budget;
using Explivio.API.Modules.Budget.Export;
using Explivio.API.Modules.Reservations;
using FluentValidation;
using Microsoft.FeatureManagement;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.DependencyInjection.Extensions;
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

// F14: retrieval-augmented generation — embeddings + place retrieval that ground the generated
// itinerary in real places. In-memory over the seeded corpus by default; Cosmos vector search when a
// connection is configured (added below).
builder.Services.AddExplivioRag(builder.Configuration);

// F14: when Cosmos is configured (the Aspire AppHost injects "cosmos"; Azure provides it when
// deployed), swap the in-memory retriever for real Cosmos vector search and seed the corpus on
// startup. Without it the API still grounds generation via the in-memory retriever, so tests and a
// bare `dotnet run` need no Cosmos. The client uses System.Text.Json (web defaults) so Place
// serializes to the camelCase documents the vector query reads back.
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("cosmos")))
{
    builder.AddAzureCosmosClient("cosmos", configureClientOptions: options =>
    {
        // Web JSON so Place serializes to the camelCase documents the vector query reads back.
        options.UseSystemTextJsonSerializerWithOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        // Gateway mode + endpoint pinning: required for the local emulator (it only exposes the
        // gateway; the default Direct/TCP mode can't reach the backend and hangs on retries). Both
        // are safe against real single-region Azure Cosmos, so we set them unconditionally.
        options.ConnectionMode = ConnectionMode.Gateway;
        options.LimitToEndpoint = true;
    });

    builder.Services.RemoveAll<IPlaceRetriever>();
    builder.Services.AddSingleton<IPlaceRetriever, CosmosPlaceRetriever>();
    builder.Services.AddHostedService<PlaceSeeder>();
}

// F22: blob storage for trip cover photos. The Aspire AppHost injects "blobs" (Azurite locally,
// real Azure Storage when deployed); without it the cover-photo endpoints report 503/404 and the
// rest of the API is unaffected — same gating posture as Cosmos and Service Bus.
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("blobs")))
{
    builder.AddAzureBlobServiceClient("blobs");
    builder.Services.AddScoped<IPhotoStorage, BlobPhotoStorage>();
}

// F32: feature flags evaluated from the "FeatureManagement" config section (appsettings / env /
// user-secrets; Azure App Configuration is the optional cloud source, not wired). Endpoints gate with
// the RequireFeature filter; GET /features exposes the states to the client.
builder.Services.AddFeatureManagement();

// F13: SignalR for streaming AI itinerary generation to the client (in-process; Azure SignalR is a
// later scaling swap). The ItineraryGenerationHub streams the generation token-by-token.
builder.Services.AddSignalR();

// F15 Phase B: real-time collaboration. TripPresence tracks who is connected per trip (ephemeral,
// in-memory singleton); the notifier pushes immediate "TripChanged" nudges to a trip's group when a
// member edits it — in-process via IHubContext, NOT via the outbox (whose 5s poll would lag).
builder.Services.AddSingleton<TripPresence>();
builder.Services.AddSingleton<ITripCollaborationNotifier, TripCollaborationNotifier>();

// F23: keeps a booking's cost mirrored into the trip budget as a linked expense.
builder.Services.AddScoped<ReservationBudgetSync>();

// F25: live exchange rates (frankfurter.dev, cached) so the budget summary can convert every
// expense into the trip's base currency. Public GET, so always registered; tests swap in a fake.
builder.Services.AddExplivioFx(builder.Configuration);

// F25: budget export writers (CSV hand-written; PDF via QuestPDF). Stateless, so singletons; the
// export endpoint resolves them all and picks one by format.
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
builder.Services.AddSingleton<IBudgetExporter, CsvBudgetExporter>();
builder.Services.AddSingleton<IBudgetExporter, PdfBudgetExporter>();

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

// F11: bring the whole schema up on startup — write model (dbo) first, then the read model (read).
// This lets a fresh clone or a fresh Aspire/Azure SQL come up with no manual `ef database update`.
// MigrateAsync is idempotent (applies only pending migrations), and the two contexts keep separate
// migrations histories, so they evolve independently. Gated on SQL being configured; retried briefly
// to tolerate SQL still warming up under the AppHost.
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("SqlServer")))
{
    await MigrateDatabaseAsync(app);
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
    // Inject a fake identity so RequireAuthorization() passes without a real B2C token.
    // F15: honour an "X-Dev-User" header (a GUID) so you can act as different users locally and
    // exercise collaboration/sharing without real auth — e.g. open two browser profiles as two
    // users. A "devUser" query parameter is accepted as a fallback because browsers can't set custom
    // headers on a WebSocket upgrade, so the SignalR collaboration hub identifies its user that way.
    // Defaults to user ...0001 when neither is present or valid.
    const string defaultDevUser = "00000000-0000-0000-0000-000000000001";
    app.Use((ctx, next) =>
    {
        var requested = ctx.Request.Headers["X-Dev-User"].FirstOrDefault()
            ?? ctx.Request.Query["devUser"].FirstOrDefault();
        var sub = Guid.TryParse(requested, out var devUser)
            ? devUser.ToString()
            : defaultDevUser;

        ctx.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", sub)], "dev"));
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

api.MapFeaturesEndpoints();
api.MapTripsEndpoints();
api.MapTripMembersEndpoints();
api.MapUsersEndpoints();
api.MapItineraryEndpoints();
api.MapBudgetEndpoints();
api.MapReservationEndpoints();

// F13: the streaming itinerary-generation hub. Not versioned like the REST group — SignalR hubs are
// addressed by a stable path; the default CORS policy and auth apply as for the rest of the app.
app.MapHub<ItineraryGenerationHub>("/hubs/itinerary-generation");

// F15 Phase B: the real-time trip collaboration hub (presence + live-edit nudges).
app.MapHub<TripCollaborationHub>("/hubs/trip-collaboration");

app.Run();

// F11: migrate the write model (dbo) then the read model (read), retrying while SQL warms up under
// the AppHost. Both run in one scope per attempt so a transient failure retries the whole set.
static async Task MigrateDatabaseAsync(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();

    for (var attempt = 1; attempt <= 10; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var write = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await write.Database.MigrateAsync();
            var read = scope.ServiceProvider.GetRequiredService<ReadDbContext>();
            await read.Database.MigrateAsync();
            return;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning(ex, "Database migration attempt {Attempt} failed; retrying.", attempt);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

// Exposes the implicit Program class to the integration test project (WebApplicationFactory<Program>).
public partial class Program;
