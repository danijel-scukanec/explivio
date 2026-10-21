using FluentValidation;

namespace Explivio.API.Modules.Trips.SetTripBaseCurrency;

public class SetTripBaseCurrencyValidator : AbstractValidator<SetTripBaseCurrencyCommand>
{
    public SetTripBaseCurrencyValidator()
    {
        RuleFor(x => x.BaseCurrency).NotEmpty().Length(3).Matches("^[A-Za-z]{3}$")
            .WithMessage("Base currency must be a 3-letter ISO currency code.");
    }
}
