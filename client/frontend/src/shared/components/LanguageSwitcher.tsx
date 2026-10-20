import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import './LanguageSwitcher.css';

// F30: switch the UI language. The choice persists (localStorage) via the i18n detector, and the
// shared date/currency formatters follow it through the `languageChanged` hook in i18n/index.ts.
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = LANGUAGES.find(l => i18n.language.startsWith(l.code))?.code ?? 'en';

  return (
    <select
      className="lang-switcher"
      value={current}
      onChange={e => i18n.changeLanguage(e.target.value)}
      aria-label={t('language.label')}
    >
      {LANGUAGES.map(l => (
        <option key={l.code} value={l.code}>🌐 {l.label}</option>
      ))}
    </select>
  );
}
