using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Trips;

// F15: a pending invitation to a trip for an email that has no Explivio account yet. Created by
// POST /members/invite when the email doesn't resolve to a user, and claimed into a TripMember the
// first time that person signs in (matched by email in the JIT user-provisioning path). Unique per
// (TripId, NormalizedEmail), so re-inviting the same address updates the role instead of duplicating.
public sealed class TripInvite
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }

    // The address as entered, for display.
    public string Email { get; set; } = string.Empty;

    // Lowercased copy used for matching on sign-in (so case doesn't matter).
    public string NormalizedEmail { get; set; } = string.Empty;

    public TripRole Role { get; set; }
    public Guid InvitedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public static TripInvite Create(Guid tripId, string email, TripRole role, Guid invitedBy) => new()
    {
        Id = Guid.NewGuid(),
        TripId = tripId,
        Email = email,
        NormalizedEmail = email.ToLowerInvariant(),
        Role = role,
        InvitedByUserId = invitedBy,
        CreatedAt = DateTime.UtcNow,
    };
}

public sealed class TripInviteConfiguration : IEntityTypeConfiguration<TripInvite>
{
    public void Configure(EntityTypeBuilder<TripInvite> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Email).HasMaxLength(256).IsRequired();
        builder.Property(i => i.NormalizedEmail).HasMaxLength(256).IsRequired();

        // One pending invite per address per trip; re-inviting updates the existing row's role.
        builder.HasIndex(i => new { i.TripId, i.NormalizedEmail }).IsUnique();

        // Claimed by email on sign-in, so that lookup is indexed too.
        builder.HasIndex(i => i.NormalizedEmail);
    }
}
