import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLocale } from '@explivio/shared';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';

// F30: languages the app ships. `label` is always shown in its own language.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
] as const;

const SUPPORTED = LANGUAGES.map(l => l.code) as string[];
const STORAGE_KEY = 'lang';

function deviceLanguage(): string {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return SUPPORTED.includes(code) ? code : 'en';
}

// Init synchronously with the device language so the first render is already localised; a saved
// choice (AsyncStorage) is applied just after, asynchronously.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false },
});

// Keep the shared formatters (dates, currency) in step, and persist the choice.
setLocale(i18n.language);
i18n.on('languageChanged', lng => {
  setLocale(lng);
  AsyncStorage.setItem(STORAGE_KEY, lng).catch(() => {});
});

AsyncStorage.getItem(STORAGE_KEY)
  .then(saved => {
    if (saved && SUPPORTED.includes(saved) && saved !== i18n.language) {
      void i18n.changeLanguage(saved);
    }
  })
  .catch(() => {});

export default i18n;
