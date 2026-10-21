namespace Explivio.API.Modules.Budget.GetBudgetBalances;

// F25: the pure settle-up algorithm, kept free of EF/HTTP so it can be unit-tested directly. Given
// each member's net position (positive = owed money, negative = owes), it produces a minimal-ish set
// of transfers that clears everyone to zero, using the classic greedy match of the largest debtor to
// the largest creditor.
public static class SettleUp
{
    public static IReadOnlyList<Settlement> Minimize(IReadOnlyList<MemberBalance> balances)
    {
        // Work in cents to avoid decimal drift while matching.
        var debtors = balances
            .Where(b => b.Net < -0.005m)
            .Select(b => (b.UserId, b.DisplayName, Cents: -(long)Math.Round(b.Net * 100)))
            .OrderByDescending(x => x.Cents)
            .ToList();
        var creditors = balances
            .Where(b => b.Net > 0.005m)
            .Select(b => (b.UserId, b.DisplayName, Cents: (long)Math.Round(b.Net * 100)))
            .OrderByDescending(x => x.Cents)
            .ToList();

        var settlements = new List<Settlement>();
        int di = 0, ci = 0;
        while (di < debtors.Count && ci < creditors.Count)
        {
            var debtor = debtors[di];
            var creditor = creditors[ci];
            var transfer = Math.Min(debtor.Cents, creditor.Cents);
            if (transfer > 0)
            {
                settlements.Add(new Settlement(
                    debtor.UserId, debtor.DisplayName,
                    creditor.UserId, creditor.DisplayName,
                    transfer / 100m));
            }

            debtor.Cents -= transfer;
            creditor.Cents -= transfer;
            debtors[di] = debtor;
            creditors[ci] = creditor;

            if (debtor.Cents == 0) di++;
            if (creditor.Cents == 0) ci++;
        }

        return settlements;
    }
}
