using Azure.Storage.Blobs;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Fx;
using Explivio.API.Infrastructure.Storage;
using Explivio.API.Infrastructure.Weather;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.Azurite;
using Testcontainers.MsSql;
using Xunit;

namespace Explivio.IntegrationTests;

// F10: boots the real API against a throwaway SQL Server started by Testcontainers, so
// integration tests exercise the full pipeline (routing, versioning, validation, Result
// flow, EF Core) against a real database — no in-memory provider substitutions.
public sealed class ExplivioApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // The dev-environment fake identity injects this 'sub'; requests are scoped to it.
    public static readonly Guid DevUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    private readonly MsSqlContainer _sqlServer =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    // F22: Azurite (the Azure Storage emulator) so the cover-photo endpoints run against real blob
    // storage in integration tests, the same way SQL is a real container.
    private readonly AzuriteContainer _azurite =
        new AzuriteBuilder("mcr.microsoft.com/azure-storage/azurite:latest").Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development enables the fake identity middleware so RequireAuthorization passes.
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:SqlServer"] = _sqlServer.GetConnectionString(),
            });
        });

        // F22: turn on the cover-photo feature against Azurite. The production gate reads the "blobs"
        // connection string at app-build time (Aspire injects it as an env var, visible then), but the
        // factory's in-memory config is layered in too late for that immediate read — so register the
        // blob client and storage directly in the test host instead.
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton(new BlobServiceClient(_azurite.GetConnectionString()));
            services.AddScoped<IPhotoStorage, BlobPhotoStorage>();
            // F24: trip documents run against the same Azurite emulator in tests.
            services.AddScoped<IDocumentStorage, BlobDocumentStorage>();
            // F17: expense receipts run against the same Azurite emulator in tests.
            services.AddScoped<IReceiptStorage, BlobReceiptStorage>();

            // F25: replace the live FX provider with a deterministic fake so budget-conversion tests
            // are repeatable and CI stays offline. Fixed rates relative to EUR.
            services.RemoveAll<IFxRateProvider>();
            services.AddSingleton<IFxRateProvider, FakeFxRateProvider>();

            // F28: likewise replace the live weather provider (Open-Meteo) with a deterministic fake
            // so the conditions tests are repeatable and need no network.
            services.RemoveAll<IWeatherProvider>();
            services.AddSingleton<IWeatherProvider, FakeWeatherProvider>();
        });
    }

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(_sqlServer.StartAsync(), _azurite.StartAsync());

        // Accessing Services builds the host with the container connection string applied.
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await _sqlServer.DisposeAsync();
        await _azurite.DisposeAsync();
        await base.DisposeAsync();
    }
}
