using FluentValidation;

namespace Explivio.API.Modules.Checklists.RenameChecklist;

public class RenameChecklistValidator : AbstractValidator<RenameChecklistCommand>
{
    public RenameChecklistValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}
