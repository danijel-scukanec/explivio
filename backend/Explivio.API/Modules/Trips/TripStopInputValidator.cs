using FluentValidation;

namespace Explivio.API.Modules.Trips;

// F22: validation for a single stop, shared by create-trip and replace-stops.
public sealed class TripStopInputValidator : AbstractValidator<TripStopInput>
{
    public TripStopInputValidator()
    {
        RuleFor(s => s.Place).NotEmpty().MaximumLength(200);

        // If both dates are given, departure can't precede arrival.
        RuleFor(s => s.DepartDate)
            .GreaterThanOrEqualTo(s => s.ArriveDate)
            .When(s => s.ArriveDate.HasValue && s.DepartDate.HasValue)
            .WithMessage("'Depart Date' must be on or after 'Arrive Date'.");

        RuleFor(s => s.Latitude).InclusiveBetween(-90, 90).When(s => s.Latitude.HasValue);
        RuleFor(s => s.Longitude).InclusiveBetween(-180, 180).When(s => s.Longitude.HasValue);
    }
}
