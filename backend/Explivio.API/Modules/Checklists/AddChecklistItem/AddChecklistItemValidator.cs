using FluentValidation;

namespace Explivio.API.Modules.Checklists.AddChecklistItem;

public class AddChecklistItemValidator : AbstractValidator<AddChecklistItemCommand>
{
    public AddChecklistItemValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.ChecklistId).NotEmpty();
        RuleFor(x => x.Text).NotEmpty().MaximumLength(500);
    }
}
