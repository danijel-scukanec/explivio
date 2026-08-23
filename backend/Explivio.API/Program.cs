using System.Security.Claims;
using System.Text.Json.Serialization;
using Asp.Versioning;
using Asp.Versioning.Builder;
using Explivio.API.Infrastructure.Api;
using Explivio.API.Infrastructure.Behaviors;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Users;
using Explivio.API.Modules.Itinerary;
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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));

builder.Services.AddSingleton(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("CosmosDb");
    var databaseName = builder.Configuration["CosmosDb:DatabaseName"] ?? "explivio";
    return new Microsoft.Azure.Cosmos.CosmosClient(connectionString);
});

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

// F09: all feature endpoints live under /v{version} (e.g. /v1/trips).
var versionSet = app.NewApiVersionSet()
    .HasApiVersion(new ApiVersion(1))
    .Build();
var api = app.MapGroup("/v{version:apiVersion}").WithApiVersionSet(versionSet);

api.MapTripsEndpoints();
api.MapUsersEndpoints();
api.MapItineraryEndpoints();
api.MapBudgetEndpoints();

app.Run();

// Exposes the implicit Program class to the integration test project (WebApplicationFactory<Program>).
public partial class Program;
