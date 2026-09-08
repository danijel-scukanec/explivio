using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Explivio.API.Infrastructure.ReadModel;

// F08: lets `dotnet ef migrations add` build the read context without the full web host. The read
// model has its own migrations history (schema "read") so it never collides with AppDbContext's.
// The connection string is irrelevant for generating migrations, so a placeholder is fine.
public sealed class ReadDbContextFactory : IDesignTimeDbContextFactory<ReadDbContext>
{
    public ReadDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ReadDbContext>()
            .UseSqlServer(
                "Server=localhost;Database=Explivio;Trusted_Connection=False;",
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", ReadDbContext.Schema))
            .Options;

        return new ReadDbContext(options);
    }
}
