using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Users;

// P-Auth constants shared by the seed, the dev-identity middleware and the current-user resolver, so
// they all agree on the identity the local fake login resolves to.
public static class DevIdentity
{
    // The default local user — matches the GUID the Development dev-identity middleware puts in the
    // token's subject, and the DevUserId the integration tests scope their requests to.
    public static readonly Guid UserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    // The subject the fake "dev" provider issues for that user (the same GUID, as a string).
    public const string Subject = "00000000-0000-0000-0000-000000000001";

    // A stable id for the seeded dev external-login row (HasData needs deterministic keys).
    private static readonly Guid LoginId = Guid.Parse("00000000-0000-0000-0000-0000000d0001");

    // A fixed timestamp for seeded rows — HasData values must be deterministic across migrations.
    private static readonly DateTime SeededAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public static User SeedUser() => new()
    {
        Id = UserId,
        Email = "dev@explivio.local",
        DisplayName = "Dev User",
        CreatedAt = SeededAt,
    };

    public static UserExternalLogin SeedLogin() => new()
    {
        Id = LoginId,
        UserId = UserId,
        Provider = ExternalLoginProviders.Dev,
        Subject = Subject,
        CreatedAt = SeededAt,
    };
}

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        // Seed the default local user so the Development fake identity (and the integration tests)
        // resolve to a real row through the same external-login path production uses.
        builder.HasData(DevIdentity.SeedUser());
    }
}

public sealed class UserExternalLoginConfiguration : IEntityTypeConfiguration<UserExternalLogin>
{
    public void Configure(EntityTypeBuilder<UserExternalLogin> builder)
    {
        builder.Property(l => l.Provider).HasMaxLength(64).IsRequired();
        builder.Property(l => l.Subject).HasMaxLength(256).IsRequired();

        // One login per (provider, subject): this is the pair an incoming token is matched on.
        builder.HasIndex(l => new { l.Provider, l.Subject }).IsUnique();

        builder.HasOne<User>()
            .WithMany(u => u.ExternalLogins)
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasData(DevIdentity.SeedLogin());
    }
}
