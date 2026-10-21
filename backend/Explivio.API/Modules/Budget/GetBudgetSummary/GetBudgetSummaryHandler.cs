using Explivio.API.Infrastructure.Database;
using Explivio.API.Infrastructure.Fx;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Explivio.API.Modules.Budget.GetBudgetSummary;

// F25: builds the budget summary, converting every expense into the trip's base currency using live
// (cached) FX rates. Replaces the old inline logic in BudgetModule that summed raw amounts across
// currencies — which was wrong the moment a trip had expenses in more than one currency.
public class GetBudgetSummaryHandler(AppDbContext db, IFxRateProvider fx)
    : IRequestHandler<GetBudgetSummaryQuery, BudgetSummaryResponse>
{
    public async Task<BudgetSummaryResponse> Handle(GetBudgetSummaryQuery query, CancellationToken cancellationToken)
    {
        var baseCurrency = await db.Trips
            .Where(t => t.Id == query.TripId)
            .Select(t => t.BaseCurrency)
            .FirstOrDefaultAsync(cancellationToken) ?? "EUR";

        var expenses = await db.Expenses
            .Where(e => e.TripId == query.TripId)
            .Include(e => e.Shares)
            .OrderByDescending(e => e.Date)
            .ToListAsync(cancellationToken);

        // One FX snapshot for the whole summary. Null when rates couldn't be fetched — we then report
        // per-currency subtotals and flag conversion as unavailable rather than a misleading total.
        var rates = await fx.GetRatesAsync(baseCurrency, cancellationToken);

        decimal? ToBase(decimal amount, string currency) =>
            string.Equals(currency, baseCurrency, StringComparison.OrdinalIgnoreCase)
                ? amount
                : rates?.ToBase(amount, currency);

        var expenseResponses = expenses
            .Select(e => new ExpenseResponse(
                e.Id, e.TripId, e.Description, e.Amount, e.Currency,
                ToBase(e.Amount, e.Currency), e.Category, e.Date, e.ReservationId, e.PaidByUserId,
                e.Shares.Select(s => new ExpenseShareResponse(s.UserId, s.Amount)).ToList()))
            .ToList();

        var total = expenseResponses.Sum(e => e.AmountInBase ?? 0m);

        var byCategory = expenseResponses
            .GroupBy(e => e.Category)
            .Select(g => new CategoryTotal(g.Key.ToString(), g.Sum(e => e.AmountInBase ?? 0m)))
            .ToList();

        var byCurrency = expenses
            .GroupBy(e => e.Currency.ToUpperInvariant())
            .Select(g => new CurrencyTotal(g.Key, g.Sum(e => e.Amount)))
            .OrderByDescending(c => c.Total)
            .ToList();

        // Conversion is "available" when rates were obtained and every expense mapped to base — the
        // single converted total is then trustworthy.
        var conversionAvailable = expenseResponses.All(e => e.AmountInBase is not null);

        return new BudgetSummaryResponse(
            baseCurrency, conversionAvailable, expenseResponses, total, byCategory, byCurrency);
    }
}
