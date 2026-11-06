import { useTranslation } from 'react-i18next';
import type { BudgetBalances } from '@explivio/shared';
import { formatCurrency } from '@explivio/shared';
import { cn } from '@/lib/utils';

interface Props {
  balances: BudgetBalances;
}

// F25: who owes whom across the trip's split expenses, plus the suggested settle-up transfers.
export function BalancesPanel({ balances }: Props) {
  const { t } = useTranslation();
  const base = balances.baseCurrency;

  return (
    <div className="bg-muted mb-6 rounded-xl border p-6">
      <h2 className="mb-4 text-base font-semibold">{t('budget.balancesTitle')}</h2>

      <div className="mb-5 flex flex-wrap gap-2.5">
        {balances.balances.map(b => {
          const net = Number(b.net);
          return (
            <div className="bg-background flex min-w-[120px] flex-col gap-0.5 rounded-[10px] border px-3.5 py-2.5" key={b.userId}>
              <span className="text-muted-foreground text-[13px]">{b.displayName}</span>
              <span className={cn(
                'text-lg font-bold tabular-nums',
                net > 0 ? 'text-green-600' : net < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}>
                {net > 0 && '+'}{formatCurrency(net, base)}
              </span>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-muted-foreground mb-2.5 text-[13px] tracking-wide uppercase">{t('budget.settleUp')}</h3>
        {balances.settlements.length === 0
          ? <p className="text-muted-foreground text-sm">{t('budget.allSettled')}</p>
          : (
            <ul className="flex flex-col gap-2">
              {balances.settlements.map((s, i) => (
                <li className="text-card-foreground flex items-center gap-2.5 text-sm" key={i}>
                  <span>{s.fromName}</span>
                  <span className="text-primary font-bold">→</span>
                  <span>{s.toName}</span>
                  <span className="ml-auto font-semibold tabular-nums">{formatCurrency(Number(s.amount), base)}</span>
                </li>
              ))}
            </ul>
          )
        }
      </div>
    </div>
  );
}
