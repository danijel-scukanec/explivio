using FluentValidation;

namespace Explivio.Modules.Trips.Application.UseCases.Commands.CreateTrip;

public sealed class CreateTripCommandValidator : AbstractValidator<CreateTripCommand>
{
    public CreateTripCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.StartDate).LessThanOrEqualTo(x => x.EndDate);
    }
}