import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MEDIA = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MEDIA).matches;
}

// Resolve the theme at first render the same way the boot script in index.html does, so the toggle's
// icon matches what's actually on screen (no mismatch / flash).
function initialDark(): boolean {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch { /* storage blocked */ }
  return systemPrefersDark();
}

// A light/dark switch. Toggling writes an explicit choice to localStorage; with no stored choice the
// app follows the OS setting (and keeps following it live until the user picks one).
export function ThemeToggle() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia(MEDIA);
    const onChange = () => {
      let hasChoice = false;
      try { hasChoice = localStorage.getItem('theme') !== null; } catch { /* ignore */ }
      if (!hasChoice) setDark(mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    setDark(prev => {
      const next = !prev;
      try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-foreground hover:bg-primary/10 grid size-8 place-items-center rounded-lg transition-colors"
      aria-label={t('theme.toggle')}
      title={t('theme.toggle')}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
