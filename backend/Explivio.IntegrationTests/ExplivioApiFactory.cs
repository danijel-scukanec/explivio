using Azure.Storage.Blobs;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
