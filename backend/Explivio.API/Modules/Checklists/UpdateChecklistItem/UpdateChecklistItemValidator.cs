using FluentValidation;

namespace Explivio.API.Modules.Checklists.UpdateChecklistItem;

public class UpdateChecklistItemValidator : AbstractValidator<UpdateChecklistItemCommand>
{
    public UpdateChecklistItemValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.ChecklistId).NotEmpty();
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Text).NotEmpty().MaximumLength(500);
    }
}
