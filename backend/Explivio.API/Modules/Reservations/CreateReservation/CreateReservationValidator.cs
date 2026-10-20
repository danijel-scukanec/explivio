using FluentValidation;

namespace Explivio.API.Modules.Reservations.CreateReservation;

public class CreateReservationValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.StartsAt).NotEmpty();
        RuleFor(x => x.EndsAt).GreaterThanOrEqualTo(x => x.StartsAt).When(x => x.EndsAt is not null);
        RuleFor(x => x.Provider).MaximumLength(200).When(x => x.Provider is not null);
        RuleFor(x => x.ConfirmationNumber).MaximumLength(100).When(x => x.ConfirmationNumber is not null);
        RuleFor(x => x.BookingUrl).MaximumLength(2000).When(x => x.BookingUrl is not null);
        RuleFor(x => x.Notes).MaximumLength(1000).When(x => x.Notes is not null);
        RuleFor(x => x.Cost).GreaterThanOrEqualTo(0).When(x => x.Cost is not null);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}
