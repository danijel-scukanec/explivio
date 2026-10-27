namespace Explivio.API.Modules.Users;

// P-Auth: one external identity-provider login for a user. The pair (Provider, Subject) is what an
// incoming token identifies the caller by; it resolves to the internal UserId. Modelled one-to-many so
// a single user can link more than one provider over time (Entra now; Google/Apple/etc. later) without
// re-keying anything — the internal User.Id stays the source of truth.
public class UserExternalLogin
{
    public Guid Id { get; set; }

    // The internal user this login belongs to.
    public Guid UserId { get; set; }

    // The identity provider that issued the subject, e.g. "entra" (or "dev" for the local fake identity).
    public string Provider { get; set; } = string.Empty;

    // The provider's stable identifier for the person (Entra's `oid`/`sub`). Unique within a provider.
    public string Subject { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

// The known identity-provider keys. Kept as constants so the resolver, seed and config agree.
public static class ExternalLoginProviders
{
    // The local Development-only fake identity (see the dev-identity middleware in Program.cs).
    public const string Dev = "dev";

    // Microsoft Entra External ID — wired up in a later P-Auth step.
    public const string Entra = "entra";
}
