using FluentValidation;

namespace Explivio.API.Modules.Itinerary.GenerateItinerary;

public class GenerateItineraryValidator : AbstractValidator<GenerateItineraryCommand>
{
    public GenerateItineraryValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.Prompt).NotEmpty().MaximumLength(1000);
        // Cap the day count so one request can't ask the model for an unbounded itinerary.
        RuleFor(x => x.Days).InclusiveBetween(1, 14);
        RuleFor(x => x.Style).MaximumLength(100).When(x => x.Style is not null);
        RuleFor(x => x.Budget).MaximumLength(100).When(x => x.Budget is not null);
    }
}
