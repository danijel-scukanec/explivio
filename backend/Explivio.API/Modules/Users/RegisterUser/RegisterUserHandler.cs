using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Users.RegisterUser;

public class RegisterUserHandler(AppDbContext db) : IRequestHandler<RegisterUserCommand, Guid>
{
    public async Task<Guid> Handle(RegisterUserCommand command, CancellationToken cancellationToken)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = command.Email,
            DisplayName = command.DisplayName,
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return user.Id;
    }
}
