using FluentValidation;

namespace Explivio.API.Modules.Trips.CreateTrip;

public class CreateTripValidator : AbstractValidator<CreateTripCommand>
{
    public CreateTripValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
        RuleFor(x => x.TravelerCount).InclusiveBetween(1, 100);

        // F22: a trip must go somewhere — at least one stop.
        RuleFor(x => x.Stops).NotEmpty().WithMessage("A trip needs at least one destination.");
        RuleForEach(x => x.Stops).SetValidator(new TripStopInputValidator());

        RuleFor(x => x.UserId).NotEmpty();

        // F25: a 3-letter ISO 4217 currency code (e.g. "EUR"). Letters only.
        RuleFor(x => x.BaseCurrency).NotEmpty().Length(3).Matches("^[A-Za-z]{3}$")
            .WithMessage("Base currency must be a 3-letter ISO currency code.");
    }
}
