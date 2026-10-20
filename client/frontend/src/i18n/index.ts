import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { setLocale } from '@explivio/shared';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';

// F30: the languages the UI ships. `label` is shown in the switcher (always in its own language).
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
] as const;

export const SUPPORTED_LANGUAGES = LANGUAGES.map(l => l.code);

i18n
  .use(LanguageDetector) // picks up ?lng=, localStorage, then the browser language on first load
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true, // map es-ES → es, de-AT → de, …
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React already escapes
  });

// Keep the shared formatters (dates, currency) in step with the active language.
setLocale(i18n.language);
i18n.on('languageChanged', lng => setLocale(lng));

export default i18n;
