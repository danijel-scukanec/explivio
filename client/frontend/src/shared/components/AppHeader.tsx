import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

// Global app header: brand (logo + name, links home) on the left, notifications on the right.
// Tinted background so it reads as a distinct bar. Not sticky.
export function AppHeader() {
  return (
    <header className="bg-primary/10 flex items-center justify-between gap-4 border-b px-5 py-2.5 sm:px-8">
      <Link to="/trips" className="flex items-center gap-2">
        <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
          <Compass className="size-4" />
        </span>
        <span className="text-foreground text-lg font-bold tracking-tight">Explivio</span>
      </Link>
      <NotificationBell />
    </header>
  );
}
