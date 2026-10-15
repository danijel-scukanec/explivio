using FluentValidation;

namespace Explivio.API.Modules.Trips.SetTripStops;

public class SetTripStopsValidator : AbstractValidator<SetTripStopsCommand>
{
    public SetTripStopsValidator()
    {
        // F22: a trip must keep at least one stop.
        RuleFor(x => x.Stops).NotEmpty().WithMessage("A trip needs at least one destination.");
        RuleForEach(x => x.Stops).SetValidator(new TripStopInputValidator());
    }
}
