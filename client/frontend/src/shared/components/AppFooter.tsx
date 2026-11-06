import { LanguageSwitcher } from './LanguageSwitcher';

// Global app footer: copyright + the language switcher (moved here out of the page headers).
export function AppFooter() {
  return (
    <footer className="text-muted-foreground mt-auto flex items-center justify-between gap-4 border-t px-5 py-4 text-sm sm:px-8">
      <span>Explivio © {new Date().getFullYear()}</span>
      <LanguageSwitcher />
    </footer>
  );
}
