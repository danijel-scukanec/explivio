import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { cn } from '@/lib/utils';

// F30: switch the UI language. The choice persists (localStorage) via the i18n detector, and the
// shared date/currency formatters follow it through the `languageChanged` hook in i18n/index.ts.
// `className` lets callers restyle it (e.g. white-on-image inside the trip hero header).
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = LANGUAGES.find(l => i18n.language.startsWith(l.code))?.code ?? 'en';

  return (
    <select
      className={cn(
        'border-input text-muted-foreground hover:border-primary focus-visible:border-ring focus-visible:ring-ring/50 cursor-pointer appearance-none rounded-lg border bg-transparent px-3 py-1.5 text-[13px] outline-none focus-visible:ring-[3px]',
        className,
      )}
      value={current}
      onChange={e => i18n.changeLanguage(e.target.value)}
      aria-label={t('language.label')}
    >
      {LANGUAGES.map(l => (
        <option key={l.code} value={l.code} className="bg-background text-foreground">🌐 {l.label}</option>
      ))}
    </select>
  );
}
