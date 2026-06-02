using MediatR;

namespace Explivio.API.Modules.Users.RegisterUser;

public record RegisterUserCommand(string Email, string DisplayName) : IRequest<Guid>;
