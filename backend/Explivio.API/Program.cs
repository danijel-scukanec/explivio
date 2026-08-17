using System.Security.Claims;
using System.Text.Json.Serialization;
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

builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));

builder.Services.AddSingleton(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("CosmosDb");
    var databaseName = builder.Configuration["CosmosDb:DatabaseName"] ?? "explivio";
    return new Microsoft.Azure.Cosmos.CosmosClient(connectionString);
});

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

app.MapTripsEndpoints();
app.MapUsersEndpoints();
app.MapItineraryEndpoints();
app.MapBudgetEndpoints();

app.Run();
