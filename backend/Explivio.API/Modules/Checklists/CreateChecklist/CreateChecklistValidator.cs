using FluentValidation;

namespace Explivio.API.Modules.Checklists.CreateChecklist;

public class CreateChecklistValidator : AbstractValidator<CreateChecklistCommand>
{
    public CreateChecklistValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}
