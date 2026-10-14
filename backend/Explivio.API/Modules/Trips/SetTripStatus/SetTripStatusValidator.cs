using FluentValidation;

namespace Explivio.API.Modules.Trips.SetTripStatus;

public class SetTripStatusValidator : AbstractValidator<SetTripStatusCommand>
{
    public SetTripStatusValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
    }
}
