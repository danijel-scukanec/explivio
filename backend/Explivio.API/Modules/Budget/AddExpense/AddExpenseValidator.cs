using FluentValidation;

namespace Explivio.API.Modules.Budget.AddExpense;

public class AddExpenseValidator : AbstractValidator<AddExpenseCommand>
{
    public AddExpenseValidator()
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.Description).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Date).NotEmpty();
    }
}
