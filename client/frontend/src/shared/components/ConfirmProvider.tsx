import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button for destructive actions (default true — this is used mainly for deletes).
  destructive?: boolean;
}

const ConfirmContext = createContext<(options?: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

// Imperative confirm: `const confirm = useConfirm(); if (await confirm({ message })) { …delete… }`.
export function useConfirm() {
  return useContext(ConfirmContext);
}

// Mounts a single shared confirm dialog and resolves a promise with the user's choice. Wrap the app.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setOptions(opts);
    });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }

  const destructive = options?.destructive ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal title={options.title ?? t('common.areYouSure')} onClose={() => settle(false)} className="max-w-[400px]">
          <ModalBody>
            <p className="text-muted-foreground text-sm">{options.message ?? t('common.cantUndo')}</p>
          </ModalBody>
          <ModalActions>
            <Button variant="secondary" onClick={() => settle(false)}>
              {options.cancelLabel ?? t('common.cancel')}
            </Button>
            <Button variant={destructive ? 'destructive' : 'default'} onClick={() => settle(true)}>
              {options.confirmLabel ?? t('common.delete')}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
