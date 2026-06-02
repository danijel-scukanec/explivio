using Explivio.API.Modules.Users.RegisterUser;
using FluentValidation;
using MediatR;

namespace Explivio.API.Modules.Users;

public static class UsersModule
{
    public static IEndpointRouteBuilder MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/users");

        group.MapPost("/register", async (RegisterUserCommand command, IMediator mediator, IValidator<RegisterUserCommand> validator) =>
        {
            var validation = await validator.ValidateAsync(command);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var id = await mediator.Send(command);
            return Results.Created($"/users/{id}", new { id });
        });

        return app;
    }
}
