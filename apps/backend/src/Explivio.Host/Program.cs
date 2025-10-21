using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Serilog;
using Explivio.Modules.Trips.Presentation;

var builder = WebApplication.CreateBuilder(args);

// ---- Logging (Serilog) ----
builder.Host.UseSerilog((ctx, cfg) =>
{
    cfg.ReadFrom.Configuration(ctx.Configuration);
});

// ---- Core ASP.NET services ----
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        // camelCase, enum strings, etc. – adjust if you like
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// ModelState behavior (let FluentValidation/MediatR handle validation)
builder.Services.Configure<ApiBehaviorOptions>(o => o.SuppressModelStateInvalidFilter = true);

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (example: allow your frontends during dev)
builder.Services.AddCors(o =>
{
    o.AddPolicy("AllowDevOrigins", policy =>
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowCredentials());
});

// Health checks (host-level; modules can add theirs in their Add*Module)
builder.Services.AddHealthChecks();

// ---- MODULES: register all modules here ----
// Trips module exposes a single extension that wires Application + Infrastructure + Presentation
builder.Services.AddTripsModule(builder.Configuration);

// Forwarded headers if behind proxy/gateway
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();

// ---- Pipeline ----
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders();
app.UseHttpsRedirection();

app.UseCors("AllowDevOrigins");

app.UseAuthentication(); // if/when you add it
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
