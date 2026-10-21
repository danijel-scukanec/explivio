using Explivio.API.Infrastructure.Database;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Budget.AddExpense;

public class AddExpenseValidator : AbstractValidator<AddExpenseCommand>
{
    // AppDbContext is injected so the split's participants can be checked against the trip's members
    // (F15). The ValidationBehavior runs validators with ValidateAsync, so the async DB rules run in
    // the request pipeline and failures surface as a 400 ProblemDetails like any other.
    public AddExpenseValidator(AppDbContext db)
    {
        RuleFor(x => x.TripId).NotEmpty();
        RuleFor(x => x.Description).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Date).NotEmpty();

        // F25: split rules only apply when the expense is actually split.
        When(x => x.Splits is { Count: > 0 }, () =>
        {
            RuleFor(x => x.PaidByUserId)
                .NotNull().WithMessage("A split expense must record who paid.");

            RuleForEach(x => x.Splits!)
                .Must(s => s.Amount > 0).WithMessage("Each split share must be a positive amount.");

            RuleFor(x => x.Splits!)
                .Must(splits => splits.Select(s => s.UserId).Distinct().Count() == splits.Count)
                .WithMessage("A member can appear only once in a split.");

            // Shares must account for the whole expense (small rounding tolerance).
            RuleFor(x => x)
                .Must(x => Math.Abs(x.Splits!.Sum(s => s.Amount) - x.Amount) <= 0.01m)
                .WithMessage("Split shares must add up to the expense amount.")
                .OverridePropertyName(nameof(AddExpenseCommand.Splits));

            // Everyone involved (payer + each share) must be a member of the trip.
            RuleFor(x => x)
                .MustAsync(async (x, ct) =>
                {
                    var participants = x.Splits!.Select(s => s.UserId)
                        .Append(x.PaidByUserId!.Value)
                        .Distinct()
                        .ToList();
                    var memberCount = await db.TripMembers
                        .CountAsync(m => m.TripId == x.TripId && participants.Contains(m.UserId), ct);
                    return memberCount == participants.Count;
                })
                .WithMessage("Everyone in a split must be a member of the trip.")
                .OverridePropertyName(nameof(AddExpenseCommand.Splits));
        });
    }
}
