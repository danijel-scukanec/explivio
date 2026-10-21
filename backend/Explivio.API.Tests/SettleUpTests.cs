using Explivio.API.Modules.Budget.GetBudgetBalances;
using Xunit;

namespace Explivio.API.Tests;

public sealed class SettleUpTests
{
    private static MemberBalance Balance(string name, decimal net) =>
        new(Guid.NewGuid(), name, 0m, 0m, net);

    [Fact]
    public void Two_people_one_transfer()
    {
        var a = Balance("A", 50m);   // owed money
        var b = Balance("B", -50m);  // owes

        var settlements = SettleUp.Minimize([a, b]);

        var s = Assert.Single(settlements);
        Assert.Equal(b.UserId, s.FromUserId);
        Assert.Equal(a.UserId, s.ToUserId);
        Assert.Equal(50m, s.Amount);
    }

    [Fact]
    public void Already_settled_produces_no_transfers()
    {
        var settlements = SettleUp.Minimize([Balance("A", 0m), Balance("B", 0m)]);
        Assert.Empty(settlements);
    }

    [Fact]
    public void Largest_debtor_matched_to_largest_creditor()
    {
        // A is owed 60, B is owed 40; C owes 100.
        var a = Balance("A", 60m);
        var b = Balance("B", 40m);
        var c = Balance("C", -100m);

        var settlements = SettleUp.Minimize([a, b, c]);

        Assert.Equal(2, settlements.Count);
        // C pays the largest creditor (A) first, then B.
        Assert.Contains(settlements, s => s.FromUserId == c.UserId && s.ToUserId == a.UserId && s.Amount == 60m);
        Assert.Contains(settlements, s => s.FromUserId == c.UserId && s.ToUserId == b.UserId && s.Amount == 40m);
    }

    [Fact]
    public void Every_transfer_balance_nets_to_zero()
    {
        var a = Balance("A", 30m);
        var b = Balance("B", -10m);
        var c = Balance("C", -20m);

        var settlements = SettleUp.Minimize([a, b, c]);

        // Total transferred to A equals what A is owed.
        var received = settlements.Where(s => s.ToUserId == a.UserId).Sum(s => s.Amount);
        Assert.Equal(30m, received);
    }
}
