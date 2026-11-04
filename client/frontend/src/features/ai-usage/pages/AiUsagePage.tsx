import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AiUsageSnapshot } from '@explivio/shared';
import { getAiUsage } from '../services/aiUsageApi';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './AiUsagePage.css';

// The generated OpenAPI types model int64/double as `number | string` (they can exceed JS's safe
// integer range), so coerce at the display boundary rather than hand-editing the generated types.
const fmt = (n: number | string) => Number(n).toLocaleString();
const cost = (n: number | string) => `$${Number(n).toFixed(4)}`;

export function AiUsagePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AiUsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setData(await getAiUsage());
    } catch {
      setError(t('aiUsage.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const total = data?.total;
  const totalTokens = total ? Number(total.inputTokens) + Number(total.outputTokens) : 0;

  return (
    <div className="aiusage-page">
      <header className="aiusage-header">
        <div>
          <Link to="/trips">← {t('aiUsage.trips')}</Link>
          <h1>{t('aiUsage.title')}</h1>
          <p className="aiusage-sub">{t('aiUsage.subtitle')}</p>
        </div>
        <div className="aiusage-actions">
          <LanguageSwitcher />
          <button className="btn btn--ghost" onClick={load}>↻ {t('aiUsage.refresh')}</button>
        </div>
      </header>

      {loading && <p className="aiusage-muted">{t('aiUsage.loading')}</p>}
      {error && <p className="aiusage-error">{error}</p>}

      {total && (
        <>
          <div className="aiusage-tiles">
            <div className="aiusage-tile"><span>{t('aiUsage.calls')}</span><strong>{fmt(total.calls)}</strong></div>
            <div className="aiusage-tile"><span>{t('aiUsage.tokens')}</span><strong>{fmt(totalTokens)}</strong></div>
            <div className="aiusage-tile"><span>{t('aiUsage.estCost')}</span><strong>{cost(total.estimatedCost)}</strong></div>
            <div className="aiusage-tile"><span>{t('aiUsage.cacheHits')}</span><strong>{fmt(total.cacheHits)}</strong></div>
          </div>

          <table className="aiusage-table">
            <thead>
              <tr>
                <th>{t('aiUsage.feature')}</th>
                <th>{t('aiUsage.model')}</th>
                <th className="num">{t('aiUsage.calls')}</th>
                <th className="num">{t('aiUsage.cacheHits')}</th>
                <th className="num">{t('aiUsage.inputTokens')}</th>
                <th className="num">{t('aiUsage.outputTokens')}</th>
                <th className="num">{t('aiUsage.estCost')}</th>
              </tr>
            </thead>
            <tbody>
              {data!.rows.length === 0 && (
                <tr><td colSpan={7} className="aiusage-muted">{t('aiUsage.empty')}</td></tr>
              )}
              {data!.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.feature}</td>
                  <td>{r.model}</td>
                  <td className="num">{fmt(r.calls)}</td>
                  <td className="num">{fmt(r.cacheHits)}</td>
                  <td className="num">{fmt(r.inputTokens)}</td>
                  <td className="num">{fmt(r.outputTokens)}</td>
                  <td className="num">{cost(r.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
