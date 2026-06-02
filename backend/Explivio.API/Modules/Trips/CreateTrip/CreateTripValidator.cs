using FluentValidation;

namespace Explivio.API.Modules.Trips.CreateTrip;

public class CreateTripValidator : AbstractValidator<CreateTripCommand>
{
    public CreateTripValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Destination).NotEmpty().MaximumLength(200);
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
        RuleFor(x => x.TravelerCount).InclusiveBetween(1, 100);
        RuleFor(x => x.UserId).NotEmpty();
    }
}
