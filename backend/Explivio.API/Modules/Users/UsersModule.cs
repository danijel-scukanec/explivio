using Explivio.API.Infrastructure.Api;
using Explivio.API.Modules.Users.RegisterUser;
using MediatR;

namespace Explivio.API.Modules.Users;

public static class UsersModule
{
    public static IEndpointRouteBuilder MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/users");

        group.MapPost("/register", async (RegisterUserCommand command, IMediator mediator) =>
        {
            var id = await mediator.Send(command);
            return Results.Created($"/users/{id}", new CreatedResponse(id));
        }).Produces<CreatedResponse>(StatusCodes.Status201Created).ProducesValidationProblem();

        return app;
    }
}
