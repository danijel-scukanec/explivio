import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

// Last-resort fallback: a rendering crash anywhere below the boundary would otherwise unmount the whole
// React tree and leave a blank white screen. This shows a recoverable message instead. Kept as a
// functional child so it can use i18n/theme like the rest of the app.
function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="bg-card w-full max-w-[400px] rounded-xl p-8 text-center shadow-xl">
        <h1 className="text-foreground mb-2 text-2xl font-semibold">{t('errors.title')}</h1>
        <p className="text-muted-foreground mb-6 text-sm">{t('errors.body')}</p>
        <Button className="w-full" size="lg" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </Button>
      </div>
    </div>
  );
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled render error', error, info);
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
