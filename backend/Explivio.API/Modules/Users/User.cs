namespace Explivio.API.Modules.Users;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // P-Auth: the external identity-provider logins linked to this user. A single internal user can
    // carry several (e.g. Entra today, "sign in with Google" later) — the identity itself is always
    // our own Id, and each provider login is just another way to recognise the same person.
    public ICollection<UserExternalLogin> ExternalLogins { get; set; } = new List<UserExternalLogin>();
}
