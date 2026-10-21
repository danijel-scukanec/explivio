using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Fx;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Budget.GetBudgetBalances;

// F25: computes each trip member's net position across split expenses (in the trip's base currency)
// and a suggested set of transfers to settle up. Only split expenses (those with a payer and shares)
// take part — an unsplit expense doesn't imply anyone owes anyone.
public class GetBudgetBalancesHandler(AppDbContext db, IFxRateProvider fx)
    : IRequestHandler<GetBudgetBalancesQuery, BudgetBalancesResponse>
{
    public async Task<BudgetBalancesResponse> Handle(GetBudgetBalancesQuery query, CancellationToken cancellationToken)
    {
        var baseCurrency = await db.Trips
            .Where(t => t.Id == query.TripId)
            .Select(t => t.BaseCurrency)
            .FirstOrDefaultAsync(cancellationToken) ?? "EUR";

        var members = await (
            from m in db.TripMembers
            join u in db.Users on m.UserId equals u.Id
            where m.TripId == query.TripId
            select new { m.UserId, u.DisplayName })
            .ToListAsync(cancellationToken);

        var expenses = await db.Expenses
            .Where(e => e.TripId == query.TripId && e.PaidByUserId != null)
            .Include(e => e.Shares)
            .ToListAsync(cancellationToken);

        var rates = await fx.GetRatesAsync(baseCurrency, cancellationToken);
        var conversionAvailable = true;

        decimal Convert(decimal amount, string currency)
        {
            if (string.Equals(currency, baseCurrency, StringComparison.OrdinalIgnoreCase))
                return amount;
            var converted = rates?.ToBase(amount, currency);
            if (converted is null)
            {
                conversionAvailable = false;
                return amount; // best-effort: fall back to the raw amount so a figure still shows
            }
            return converted.Value;
        }

        var paid = members.ToDictionary(m => m.UserId, _ => 0m);
        var owed = members.ToDictionary(m => m.UserId, _ => 0m);

        foreach (var e in expenses)
        {
            if (e.PaidByUserId is { } payer && paid.ContainsKey(payer))
                paid[payer] += Convert(e.Amount, e.Currency);

            foreach (var share in e.Shares)
            {
                if (owed.ContainsKey(share.UserId))
                    owed[share.UserId] += Convert(share.Amount, e.Currency);
            }
        }

        var balances = members
            .Select(m => new MemberBalance(
                m.UserId,
                m.DisplayName,
                decimal.Round(paid[m.UserId], 2),
                decimal.Round(owed[m.UserId], 2),
                decimal.Round(paid[m.UserId] - owed[m.UserId], 2)))
            .OrderByDescending(b => b.Net)
            .ToList();

        var settlements = SettleUp.Minimize(balances);

        return new BudgetBalancesResponse(baseCurrency, conversionAvailable, balances, settlements);
    }
}
