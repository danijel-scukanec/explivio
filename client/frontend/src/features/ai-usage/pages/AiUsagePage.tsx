import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiUsageSnapshot } from '@explivio/shared';
import { getAiUsage } from '../services/aiUsageApi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

  const th = 'text-muted-foreground border-b px-3 py-2.5 text-left font-semibold';
  const thNum = `${th} text-right`;
  const td = 'border-b px-3 py-2.5';
  const tdNum = `${td} text-right tabular-nums`;

  return (
    <div className="mx-auto max-w-[920px] px-4 pt-6 pb-16">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground mb-0.5 text-2xl font-semibold">{t('aiUsage.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('aiUsage.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load}>↻ {t('aiUsage.refresh')}</Button>
        </div>
      </header>

      {loading && <p className="text-muted-foreground">{t('aiUsage.loading')}</p>}
      {error && <p className="text-destructive">{error}</p>}

      {total && (
        <>
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {([
              [t('aiUsage.calls'), fmt(total.calls)],
              [t('aiUsage.tokens'), fmt(totalTokens)],
              [t('aiUsage.estCost'), cost(total.estimatedCost)],
              [t('aiUsage.cacheHits'), fmt(total.cacheHits)],
            ] as const).map(([label, value]) => (
              <Card key={label} className="gap-1.5 p-4">
                <span className="text-muted-foreground text-xs tracking-wide uppercase">{label}</span>
                <strong className="text-foreground text-2xl">{value}</strong>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>{t('aiUsage.feature')}</th>
                  <th className={th}>{t('aiUsage.model')}</th>
                  <th className={thNum}>{t('aiUsage.calls')}</th>
                  <th className={thNum}>{t('aiUsage.cacheHits')}</th>
                  <th className={thNum}>{t('aiUsage.inputTokens')}</th>
                  <th className={thNum}>{t('aiUsage.outputTokens')}</th>
                  <th className={thNum}>{t('aiUsage.estCost')}</th>
                </tr>
              </thead>
              <tbody>
                {data!.rows.length === 0 && (
                  <tr><td colSpan={7} className={`${td} text-muted-foreground`}>{t('aiUsage.empty')}</td></tr>
                )}
                {data!.rows.map((r, i) => (
                  <tr key={i}>
                    <td className={td}>{r.feature}</td>
                    <td className={td}>{r.model}</td>
                    <td className={tdNum}>{fmt(r.calls)}</td>
                    <td className={tdNum}>{fmt(r.cacheHits)}</td>
                    <td className={tdNum}>{fmt(r.inputTokens)}</td>
                    <td className={tdNum}>{fmt(r.outputTokens)}</td>
                    <td className={tdNum}>{cost(r.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
