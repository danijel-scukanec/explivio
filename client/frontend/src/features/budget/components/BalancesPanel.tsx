import { useTranslation } from 'react-i18next';
import type { BudgetBalances } from '@explivio/shared';
import { formatCurrency } from '@explivio/shared';
import './BalancesPanel.css';

interface Props {
  balances: BudgetBalances;
}

// F25: who owes whom across the trip's split expenses, plus the suggested settle-up transfers.
export function BalancesPanel({ balances }: Props) {
  const { t } = useTranslation();
  const base = balances.baseCurrency;

  return (
    <div className="balances-panel">
      <h2 className="balances-panel__title">{t('budget.balancesTitle')}</h2>

      <div className="balances-panel__members">
        {balances.balances.map(b => {
          const net = Number(b.net);
          const state = net > 0 ? 'owed' : net < 0 ? 'owes' : 'even';
          return (
            <div className="balances-panel__member" key={b.userId}>
              <span className="balances-panel__member-name">{b.displayName}</span>
              <span className={`balances-panel__net balances-panel__net--${state}`}>
                {net > 0 && '+'}{formatCurrency(net, base)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="balances-panel__settlements">
        <h3 className="balances-panel__subtitle">{t('budget.settleUp')}</h3>
        {balances.settlements.length === 0
          ? <p className="balances-panel__even">{t('budget.allSettled')}</p>
          : (
            <ul className="balances-panel__transfers">
              {balances.settlements.map((s, i) => (
                <li className="balances-panel__transfer" key={i}>
                  <span className="balances-panel__from">{s.fromName}</span>
                  <span className="balances-panel__arrow">→</span>
                  <span className="balances-panel__to">{s.toName}</span>
                  <span className="balances-panel__amount">{formatCurrency(Number(s.amount), base)}</span>
                </li>
              ))}
            </ul>
          )
        }
      </div>
    </div>
  );
}
