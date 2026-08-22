using FluentValidation;
using MediatR;

namespace Explivio.API.Infrastructure.Behaviors;

/// <summary>
/// Runs every registered <see cref="IValidator{T}"/> for a request before the handler.
/// On failure it throws <see cref="ValidationException"/>, which the global exception
/// handler turns into a 400 ProblemDetails — so the handler never sees invalid input and
/// endpoints no longer validate by hand.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (validators.Any())
        {
            var context = new ValidationContext<TRequest>(request);

            var results = await Task.WhenAll(
                validators.Select(v => v.ValidateAsync(context, cancellationToken)));

            var failures = results
                .SelectMany(r => r.Errors)
                .Where(f => f is not null)
                .ToList();

            if (failures.Count != 0)
                throw new ValidationException(failures);
        }

        return await next();
    }
}
