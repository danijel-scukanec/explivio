using Explivio.API.Infrastructure.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
    }

    public async ValueTask InitializeAsync()
    {
        await _sqlServer.StartAsync();

        // Accessing Services builds the host with the container connection string applied.
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await _sqlServer.DisposeAsync();
        await base.DisposeAsync();
    }
}
