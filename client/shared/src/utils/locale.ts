// F30: the active UI locale, set by the app's i18n layer so shared formatters (dates, currency)
// render in the chosen language without every call site threading a locale argument. Falls back to a
// fixed default until set (e.g. on mobile before its i18n initialises).
let activeLocale: string | undefined;

export function setLocale(locale: string | undefined): void {
  activeLocale = locale;
}

export function getLocale(): string | undefined {
  return activeLocale;
}
